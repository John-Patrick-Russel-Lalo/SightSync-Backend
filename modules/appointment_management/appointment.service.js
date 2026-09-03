
import pool from "../../shared/config/db.js";

// Helper Functions
function timeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(":").map(Number);
    return hours * 60 + minutes;
}

function minutesToTime(totalMinutes) {
    const hours = Math.floor(totalMinutes / 60)
        .toString()
        .padStart(2, "0");
    const minutes = (totalMinutes % 60)
        .toString()
        .padStart(2, "0");
    return `${hours}:${minutes}`;
}

export async function getAvailableSlots(doctorId, selectedDate) {
    // 1. Fetch Doctor Profile for slot duration
    const profileRes = await pool.query(
        `SELECT slot_duration_minutes FROM doctor_profiles WHERE user_id = $1`,
        [doctorId]
    );

    if (profileRes.rows.length === 0) return [];
    const slotDuration = profileRes.rows[0].slot_duration_minutes || 30;

    // 2. Check for Date Override First (Overrides take absolute priority)
    const overrideRes = await pool.query(
        `
        SELECT 
            TO_CHAR(start_time, 'HH24:MI') AS start_time,
            TO_CHAR(end_time, 'HH24:MI') AS end_time,
            is_unavailable
        FROM doctor_schedule_overrides
        WHERE doctor_id = $1 AND override_date = $2::date
        `,
        [doctorId, selectedDate]
    );

    let shifts = [];

    if (overrideRes.rows.length > 0) {
        const override = overrideRes.rows[0];
        if (override.is_unavailable) return [];
        if (override.start_time && override.end_time) {
            shifts.push(override);
        }
    } else {
        // Fall back to regular weekly recurring shifts
        const scheduleRes = await pool.query(
            `
            SELECT 
                TO_CHAR(start_time, 'HH24:MI') AS start_time,
                TO_CHAR(end_time, 'HH24:MI') AS end_time
            FROM doctor_schedules
            WHERE doctor_id = $1 
              AND day_of_week = EXTRACT(DOW FROM $2::date)
              AND is_active = TRUE
            `,
            [doctorId, selectedDate]
        );
        shifts = scheduleRes.rows;
    }

    if (shifts.length === 0) return [];

    // 3. Fetch Booked Appointments
    const bookedRes = await pool.query(
        `
        SELECT 
            TO_CHAR(start_time, 'HH24:MI') AS start_time,
            TO_CHAR(end_time, 'HH24:MI') AS end_time
        FROM appointments
        WHERE doctor_id = $1 
          AND start_time >= $2::date 
          AND start_time < ($2::date + INTERVAL '1 day')
          AND status NOT IN ('cancelled', 'no_show')
        `,
        [doctorId, selectedDate]
    );

    const bookedSlots = bookedRes.rows.map((b) => ({
        start: timeToMinutes(b.start_time),
        end: timeToMinutes(b.end_time)
    }));

    // 4. Calculate free slots across all working shifts
    const availableSlots = [];

    for (const shift of shifts) {
        const shiftStartMin = timeToMinutes(shift.start_time);
        const shiftEndMin = timeToMinutes(shift.end_time);

        let currentSlotStart = shiftStartMin;

        while (currentSlotStart + slotDuration <= shiftEndMin) {
            const currentSlotEnd = currentSlotStart + slotDuration;

            const isBooked = bookedSlots.some(
                (b) => currentSlotStart < b.end && currentSlotEnd > b.start
            );

            if (!isBooked) {
                availableSlots.push(minutesToTime(currentSlotStart));
            }

            currentSlotStart += slotDuration;
        }
    }

    return availableSlots;
}

export async function getAllAppointments() {
    const result = await pool.query(
        `SELECT * FROM appointments`
    );
    return result.rows;
}

export async function createAppointment({ doctorId, patientId, date, slot, notes }) {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        // 1. Lock & fetch Doctor Profile
        const doctorRes = await client.query(
            `SELECT slot_duration_minutes FROM doctor_profiles WHERE user_id = $1 FOR UPDATE`,
            [doctorId]
        );

        if (doctorRes.rows.length === 0) {
            await client.query("ROLLBACK");
            return {
                success: false,
                statusCode: 400,
                message: `Doctor profile for user_id ${doctorId} does not exist.`
            };
        }

        const slotDuration = doctorRes.rows[0].slot_duration_minutes || 30;

        // 2. Fetch Working Shifts for the Requested Date (Overrides prioritized over regular schedule)
        const overrideRes = await client.query(
            `
            SELECT 
                TO_CHAR(start_time, 'HH24:MI') AS start_time,
                TO_CHAR(end_time, 'HH24:MI') AS end_time,
                is_unavailable
            FROM doctor_schedule_overrides
            WHERE doctor_id = $1 AND override_date = $2::date
            `,
            [doctorId, date]
        );

        let shifts = [];

        if (overrideRes.rows.length > 0) {
            const override = overrideRes.rows[0];
            if (override.is_unavailable) {
                await client.query("ROLLBACK");
                return {
                    success: false,
                    statusCode: 400,
                    message: "Doctor is unavailable on this date."
                };
            }
            if (override.start_time && override.end_time) {
                shifts.push(override);
            }
        } else {
            const scheduleRes = await client.query(
                `
                SELECT 
                    TO_CHAR(start_time, 'HH24:MI') AS start_time,
                    TO_CHAR(end_time, 'HH24:MI') AS end_time
                FROM doctor_schedules
                WHERE doctor_id = $1 
                  AND day_of_week = EXTRACT(DOW FROM $2::date)
                  AND is_active = TRUE
                `,
                [doctorId, date]
            );
            shifts = scheduleRes.rows;
        }

        if (shifts.length === 0) {
            await client.query("ROLLBACK");
            return {
                success: false,
                statusCode: 400,
                message: "Doctor has no working schedule on this date."
            };
        }

        // 3. Verify requested slot falls ENTIRELY within an active shift
        const reqStartMin = timeToMinutes(slot);
        const reqEndMin = reqStartMin + slotDuration;

        const fitsInShift = shifts.some((shift) => {
            const shiftStartMin = timeToMinutes(shift.start_time);
            const shiftEndMin = timeToMinutes(shift.end_time);
            return reqStartMin >= shiftStartMin && reqEndMin <= shiftEndMin;
        });

        if (!fitsInShift) {
            await client.query("ROLLBACK");
            return {
                success: false,
                statusCode: 400,
                message: "The requested time slot falls outside the doctor's working hours."
            };
        }

        // 4. Calculate SQL formatted timestamps
        const slotEnd = minutesToTime(reqEndMin);
        const startTime = `${date} ${slot}:00`;
        const endTime = `${date} ${slotEnd}:00`;

        // 5. Check for overlapping appointments
        const conflictCheck = await client.query(
            `
            SELECT id 
            FROM appointments
            WHERE doctor_id = $1
              AND status NOT IN ('cancelled', 'no_show')
              AND start_time < $3::timestamp 
              AND end_time > $2::timestamp
            `,
            [doctorId, startTime, endTime]
        );

        if (conflictCheck.rows.length > 0) {
            await client.query("ROLLBACK");
            return {
                success: false,
                statusCode: 409,
                message: "This slot is no longer available. Please select another time."
            };
        }

        // 6. Create the appointment
        const insertRes = await client.query(
            `
            INSERT INTO appointments (
                doctor_id, 
                patient_id, 
                start_time, 
                end_time, 
                notes, 
                status
            )
            VALUES ($1, $2, $3::timestamp, $4::timestamp, $5, 'scheduled')
            RETURNING id, doctor_id, patient_id, 
                      TO_CHAR(start_time, 'YYYY-MM-DD HH24:MI:SS') AS start_time,
                      TO_CHAR(end_time, 'YYYY-MM-DD HH24:MI:SS') AS end_time,
                      status, notes, created_at
            `,
            [doctorId, patientId, startTime, endTime, notes || null]
        );

        await client.query("COMMIT");

        return {
            success: true,
            statusCode: 201,
            data: insertRes.rows[0]
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}