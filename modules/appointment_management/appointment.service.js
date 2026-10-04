
import pool from "../../shared/config/db.js";

// Helper Functions
function timeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(":").map(Number);
    return hours * 60 + minutes;
}

// The half-down payment a patient has to attach when requesting an appointment.
export function getHalfPaymentAmount(consultationFee) {
    const fee = Number(consultationFee);
    if (!Number.isFinite(fee) || fee <= 0) return 0;
    return Math.round((fee / 2) * 100) / 100;
}

// The payment proof image is stored as BYTEA, so it must never be serialized
// into a list response. Strip it and expose a lightweight flag instead.
function toAppointmentRow(row) {
    if (!row) return row;

    const { payment_proof, ...rest } = row;
    return { ...rest, has_payment_proof: Boolean(payment_proof) };
}

function toAppointmentRows(rows) {
    return rows.map(toAppointmentRow);
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
          AND status NOT IN ('cancelled', 'declined', 'no_show')
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
    return toAppointmentRows(result.rows);
}

export async function getAppointmentByDoctorId(doctorId) {
    const result = await pool.query(
        `SELECT * FROM appointments WHERE doctor_id = $1`,
        [doctorId]
    );
    return toAppointmentRows(result.rows);
}

export async function getAppointmentByPatientId(patientId) {
    const result = await pool.query(
        `SELECT * FROM appointments WHERE patient_id = $1 ORDER BY start_time DESC`,
        [patientId]
    );
    return toAppointmentRows(result.rows);
}

export async function getAppointmentById(id) {
    const result = await pool.query(
        `SELECT * FROM appointments WHERE id = $1`,
        [id]
    );
    return toAppointmentRow(result.rows[0]);
}

// Returns the raw image bytes for an appointment's payment proof, or null when
// no proof was uploaded. Archived appointments keep their proof so the history
// log can still show what was paid. The owning doctor/patient travel with the
// proof so the caller can authorize access against the exact row it read.
export async function getAppointmentPaymentProof(id) {
    const activeRes = await pool.query(
        `SELECT payment_proof, payment_proof_mime, payment_proof_filename, doctor_id, patient_id
         FROM appointments WHERE id = $1`,
        [id]
    );

    if (activeRes.rows.length > 0) {
        const proof = toPaymentProof(activeRes.rows[0]);
        return proof ? { ...proof, ...pickOwner(activeRes.rows[0]) } : null;
    }

    const archivedRes = await pool.query(
        `SELECT payment_proof, payment_proof_mime, payment_proof_filename, doctor_id, patient_id
         FROM appointment_archive WHERE id = $1`,
        [id]
    );

    if (archivedRes.rows.length === 0) return null;

    const proof = toPaymentProof(archivedRes.rows[0]);
    return proof ? { ...proof, ...pickOwner(archivedRes.rows[0]) } : null;
}

function pickOwner(row) {
    return { doctor_id: row.doctor_id, patient_id: row.patient_id };
}

function toPaymentProof(row) {
    if (!row || !row.payment_proof) return null;

    return {
        buffer: row.payment_proof,
        mime: row.payment_proof_mime || "application/octet-stream",
        filename: row.payment_proof_filename || "payment-proof",
    };
}

// Records the admin's decision on a submitted payment proof. 'verified' unlocks
// the appointment for approval; 'rejected' sends it back to the patient.
export async function updateAppointmentPaymentStatus(id, { status, verifiedBy, rejectionReason }) {
    const result = await pool.query(
        `
        UPDATE appointments
        SET payment_status = $2::appointment_payment_status,
            payment_rejection_reason = $3,
            payment_verified_by = $4,
            payment_verified_at = CASE WHEN $2 = 'verified' THEN CURRENT_TIMESTAMP ELSE NULL END
        WHERE id = $1
        RETURNING id, doctor_id, patient_id, status, notes,
                  consultation_fee, payment_amount, payment_status,
                  payment_rejection_reason, payment_verified_by, payment_verified_at,
                  (payment_proof IS NOT NULL) AS has_payment_proof
        `,
        [id, status, rejectionReason || null, verifiedBy || null]
    );

    return toAppointmentRow(result.rows[0]);
}

export async function updateAppointmentStatus(id, status) {
    const result = await pool.query(
        `UPDATE appointments SET status = $1 WHERE id = $2 RETURNING *`,
        [status, id]
    );
    return toAppointmentRow(result.rows[0]);
}

export async function archiveAppointment(id, status) {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        // Move the appointment to the archive (history) and free up its time slot.
        // source_appointment_id keeps the link to the booking it came from and its
        // unique index stops a second archive entry (and a second no-show
        // notification) for the same booking.
        const archivedRes = await client.query(
            `
            INSERT INTO appointment_archive (
                source_appointment_id,
                doctor_id, patient_id, start_time, end_time, notes, status, created_at, updated_at,
                payment_proof, payment_proof_mime, payment_proof_filename,
                consultation_fee, payment_amount, payment_status,
                payment_rejection_reason, payment_verified_by, payment_verified_at
            )
            SELECT id, doctor_id, patient_id, start_time, end_time, notes, $2, created_at, CURRENT_TIMESTAMP,
                   payment_proof, payment_proof_mime, payment_proof_filename,
                   consultation_fee, payment_amount, payment_status,
                   payment_rejection_reason, payment_verified_by, payment_verified_at
            FROM appointments
            WHERE id = $1
            ON CONFLICT (source_appointment_id) WHERE source_appointment_id IS NOT NULL DO NOTHING
            RETURNING *
            `,
            [id, status]
        );

        if (archivedRes.rows.length === 0) {
            await client.query("ROLLBACK");
            return {
                success: false,
                statusCode: 404,
                message: "Appointment not found."
            };
        }

        await client.query(
            `DELETE FROM appointments WHERE id = $1`,
            [id]
        );

        await client.query("COMMIT");

        return {
            success: true,
            statusCode: 200,
            data: toAppointmentRow(archivedRes.rows[0])
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

export async function getArchivedAppointments() {
    const result = await pool.query(
        `SELECT * FROM appointment_archive ORDER BY archived_at DESC`
    );
    return toAppointmentRows(result.rows);
}

export async function getArchivedAppointmentsByUser(userId) {
    const result = await pool.query(
        `SELECT * FROM appointment_archive 
         WHERE patient_id = $1 OR doctor_id = $1 
         ORDER BY archived_at DESC`,
        [userId]
    );
    return toAppointmentRows(result.rows);
}

export async function createAppointment({ doctorId, patientId, date, slot, notes, paymentProof }) {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        // 1. Lock & fetch Doctor Profile
        const doctorRes = await client.query(
            `SELECT slot_duration_minutes, consultation_fee
             FROM doctor_profiles WHERE user_id = $1 FOR UPDATE`,
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
        // Snapshot the fee at booking time so later fee changes don't rewrite history.
        const rawFee = Number(doctorRes.rows[0].consultation_fee);
        const consultationFee =
            Number.isFinite(rawFee) && rawFee > 0 ? Math.round(rawFee * 100) / 100 : 0;
        const paymentAmount = getHalfPaymentAmount(consultationFee);

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
              AND status NOT IN ('cancelled', 'declined', 'no_show')
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
        const hasProof = Boolean(paymentProof?.buffer);
        const insertRes = await client.query(
            `
            INSERT INTO appointments (
                doctor_id, 
                patient_id, 
                start_time, 
                end_time, 
                notes, 
                status,
                payment_proof,
                payment_proof_mime,
                payment_proof_filename,
                consultation_fee,
                payment_amount,
                payment_status
            )
            VALUES ($1, $2, $3::timestamp, $4::timestamp, $5, 'pending', $6, $7, $8, $9, $10, $11::appointment_payment_status)
            RETURNING id, doctor_id, patient_id, 
                      TO_CHAR(start_time, 'YYYY-MM-DD HH24:MI:SS') AS start_time,
                      TO_CHAR(end_time, 'YYYY-MM-DD HH24:MI:SS') AS end_time,
                      status, notes, created_at,
                      consultation_fee, payment_amount, payment_status,
                      (payment_proof IS NOT NULL) AS has_payment_proof
            `,
            [
                doctorId,
                patientId,
                startTime,
                endTime,
                notes || null,
                hasProof ? paymentProof.buffer : null,
                hasProof ? paymentProof.mimetype : null,
                hasProof ? paymentProof.originalname : null,
                consultationFee,
                paymentAmount,
                hasProof ? "submitted" : "unsubmitted",
            ]
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