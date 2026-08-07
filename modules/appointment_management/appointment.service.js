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
        if (override.is_unavailable) return []; // Entire day is explicitly blocked
        if (override.start_time && override.end_time) {
            shifts.push(override);
        }
    } else {
        // Fall back to regular weekly recurring shifts (supports multiple shifts per day)
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

    // 3. Fetch Booked Appointments (Index-friendly range query + PG formatted time)
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

            // Check overlap: (StartA < EndB) AND (EndA > StartB)
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


export async function createAppointment({ doctorId, patientId, startTime, endTime, notes }) {
    const client = await pool.connect();

    try {
        // Begin Transaction
        await client.query("BEGIN");

        // 1. Lock the doctor profile row to serialize concurrent booking attempts for this doctor
        await client.query(
            `SELECT id FROM doctor_profiles WHERE user_id = $1 FOR UPDATE`,
            [doctorId]
        );

        // 2. Check for overlapping active appointments
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

        // 3. Create the appointment
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
            VALUES ($1, $2, $3, $4, $5, 'scheduled')
            RETURNING id, doctor_id, patient_id, start_time, end_time, status, notes, created_at
            `,
            [doctorId, patientId, startTime, endTime, notes || null]
        );

        // Commit Transaction
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