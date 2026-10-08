import pool from "../../shared/config/db.js";

export async function getPatientProfileByUserId(userId) {
    const result = await pool.query(
        `
        SELECT 
            u.id AS user_id,
            u.email,
            u.username,
            u.display_name,
            u.avatar_url,
            u.role,
            p.id AS profile_id,
            p.date_of_birth,
            p.gender,
            p.phone_number,
            p.blood_type,
            p.emergency_contact_name,
            p.emergency_contact_phone,
            p.insurance_provider,
            p.insurance_policy_number,
            p.profile_edit_count,
            p.updated_at
        FROM users u
        INNER JOIN patient_profiles p ON u.id = p.user_id
        WHERE u.id = $1
        `,
        [userId]
    );

    return result.rows[0] || null;
}


// export async function updatePatientProfileByUser(
//     userId,
//     profileData,
//     isAdmin = false
// ) {
//     const {
//         dateOfBirth,
//         gender,
//         phoneNumber,
//         bloodType,
//         emergencyContactName,
//         emergencyContactPhone,
//         insuranceProvider,
//         insurancePolicyNumber
//     } = profileData;

//     // Get the current profile first
//     const profileResult = await pool.query(
//         `
//         SELECT profile_edit_count
//         FROM patient_profiles
//         WHERE user_id = $1
//         `,
//         [userId]
//     );

//     const profile = profileResult.rows[0];

//     if (!profile) {
//         throw new Error("Patient profile not found.");
//     }

//     // Patient already used their one edit
//     if (!isAdmin && profile.profile_edit_count >= 1) {
//         const error = new Error(
//             "You have already used your one allowed profile edit. Please contact an administrator to make further changes."
//         );

//         error.statusCode = 403;

//         throw error;
//     }

//     const result = await pool.query(
//         `
//         UPDATE patient_profiles
//         SET 
//             date_of_birth = COALESCE($1, date_of_birth),
//             gender = COALESCE($2, gender),
//             phone_number = COALESCE($3, phone_number),
//             blood_type = COALESCE($4, blood_type),
//             emergency_contact_name = COALESCE($5, emergency_contact_name),
//             emergency_contact_phone = COALESCE($6, emergency_contact_phone),
//             insurance_provider = COALESCE($7, insurance_provider),
//             insurance_policy_number = COALESCE($8, insurance_policy_number),

//             profile_edit_count =
//                 CASE
//                     WHEN $9 = FALSE
//                     THEN profile_edit_count + 1
//                     ELSE profile_edit_count
//                 END,

//             updated_at = CURRENT_TIMESTAMP

//         WHERE user_id = $10

//         RETURNING *
//         `,
//         [
//             dateOfBirth || null,
//             gender || null,
//             phoneNumber || null,
//             bloodType || null,
//             emergencyContactName || null,
//             emergencyContactPhone || null,
//             insuranceProvider || null,
//             insurancePolicyNumber || null,
//             isAdmin,
//             userId
//         ]
//     );

//     return result.rows[0];
// }

export async function updatePatientProfileByUser(
    userId,
    profileData,
    isAdmin = false
) {
    const {
        dateOfBirth,
        gender,
        phoneNumber,
        bloodType,
        emergencyContactName,
        emergencyContactPhone,
        insuranceProvider,
        insurancePolicyNumber
    } = profileData;

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        // 1. Fetch current profile state
        const profileResult = await client.query(
            `
            SELECT profile_edit_count
            FROM patient_profiles
            WHERE user_id = $1
            FOR UPDATE
            `,
            [userId]
        );

        const profile = profileResult.rows[0];

        if (!profile) {
            const error = new Error("Patient profile not found.");
            error.statusCode = 404;
            throw error;
        }

        // 2. Enforce 1-edit limit for non-admins
        if (!isAdmin && profile.profile_edit_count >= 1) {
            const error = new Error(
                "You have already used your one allowed profile edit. Please contact an administrator to make further changes."
            );
            error.statusCode = 403;
            throw error;
        }

        // 3. Update patient_profiles
        const updateProfileResult = await client.query(
            `
            UPDATE patient_profiles
            SET 
                date_of_birth = COALESCE($1, date_of_birth),
                gender = COALESCE($2, gender),
                phone_number = COALESCE($3, phone_number),
                blood_type = COALESCE($4, blood_type),
                emergency_contact_name = COALESCE($5, emergency_contact_name),
                emergency_contact_phone = COALESCE($6, emergency_contact_phone),
                insurance_provider = COALESCE($7, insurance_provider),
                insurance_policy_number = COALESCE($8, insurance_policy_number),
                profile_edit_count = CASE
                    WHEN $9 = FALSE THEN profile_edit_count + 1
                    ELSE profile_edit_count
                END,
                updated_at = CURRENT_TIMESTAMP
            WHERE user_id = $10
            RETURNING *
            `,
            [
                dateOfBirth || null,
                gender || null,
                phoneNumber || null,
                bloodType || null,
                emergencyContactName || null,
                emergencyContactPhone || null,
                insuranceProvider || null,
                insurancePolicyNumber || null,
                isAdmin,
                userId
            ]
        );

        // 4. Update status in users table from 'pending' to 'active'
        await client.query(
            `
            UPDATE users
            SET status = 'active'
            WHERE id = $1 AND status = 'pending'
            `,
            [userId]
        );

        await client.query("COMMIT");
        return updateProfileResult.rows[0];
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

// export async function updatePatientProfile(userId, profileData) {
//     const {
//         dateOfBirth,
//         gender,
//         phoneNumber,
//         bloodType,
//         emergencyContactName,
//         emergencyContactPhone,
//         insuranceProvider,
//         insurancePolicyNumber
//     } = profileData;

//     const result = await pool.query(
//         `
//         UPDATE patient_profiles
//         SET 
//             date_of_birth = COALESCE($1, date_of_birth),
//             gender = COALESCE($2, gender),
//             phone_number = COALESCE($3, phone_number),
//             blood_type = COALESCE($4, blood_type),
//             emergency_contact_name = COALESCE($5, emergency_contact_name),
//             emergency_contact_phone = COALESCE($6, emergency_contact_phone),
//             insurance_provider = COALESCE($7, insurance_provider),
//             insurance_policy_number = COALESCE($8, insurance_policy_number),
//             updated_at = CURRENT_TIMESTAMP
//         WHERE user_id = $9
//         RETURNING *
//         `,
//         [
//             dateOfBirth || null,
//             gender || null,
//             phoneNumber || null,
//             bloodType || null,
//             emergencyContactName || null,
//             emergencyContactPhone || null,
//             insuranceProvider || null,
//             insurancePolicyNumber || null,
//             userId
//         ]
//     );

//     return result.rows[0];
// }

export async function updatePatientProfile(userId, profileData) {
    const {
        dateOfBirth,
        gender,
        phoneNumber,
        bloodType,
        emergencyContactName,
        emergencyContactPhone,
        insuranceProvider,
        insurancePolicyNumber
    } = profileData;

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        // 1. Update patient_profiles
        const profileResult = await client.query(
            `
            UPDATE patient_profiles
            SET 
                date_of_birth = COALESCE($1, date_of_birth),
                gender = COALESCE($2, gender),
                phone_number = COALESCE($3, phone_number),
                blood_type = COALESCE($4, blood_type),
                emergency_contact_name = COALESCE($5, emergency_contact_name),
                emergency_contact_phone = COALESCE($6, emergency_contact_phone),
                insurance_provider = COALESCE($7, insurance_provider),
                insurance_policy_number = COALESCE($8, insurance_policy_number),
                updated_at = CURRENT_TIMESTAMP
            WHERE user_id = $9
            RETURNING *
            `,
            [
                dateOfBirth || null,
                gender || null,
                phoneNumber || null,
                bloodType || null,
                emergencyContactName || null,
                emergencyContactPhone || null,
                insuranceProvider || null,
                insurancePolicyNumber || null,
                userId
            ]
        );

        if (profileResult.rows.length === 0) {
            const error = new Error("Patient profile not found.");
            error.statusCode = 404;
            throw error;
        }

        // 2. Automatically change status from 'pending' to 'active'
        await client.query(
            `
            UPDATE users
            SET status = 'active'
            WHERE id = $1 AND status = 'pending'
            `,
            [userId]
        );

        await client.query("COMMIT");
        return profileResult.rows[0];
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

export async function updatePatientStatus(patientId, status) {
    const result = await pool.query(
        `
        UPDATE users
        SET status = $1
        WHERE id = $2
        RETURNING *
        `,
        [status, patientId]
    );

    return result.rows[0];
}

// A full clinical report for one patient: personal info, every appointment
// (active and archived) with the attending doctor's name, and the patient's
// consultation-note history. Used by the admin and doctor portals.
export async function getPatientReport(patientId) {
    const [patientRes, activeRes, archivedRes, notesRes] = await Promise.all([
        pool.query(
            `
            SELECT
                u.id AS user_id,
                u.email,
                u.username,
                u.display_name,
                u.avatar_url,
                u.role,
                u.status,
                p.id AS profile_id,
                p.date_of_birth,
                p.gender,
                p.phone_number,
                p.blood_type,
                p.emergency_contact_name,
                p.emergency_contact_phone,
                p.insurance_provider,
                p.insurance_policy_number,
                p.updated_at AS profile_updated_at
            FROM users u
            LEFT JOIN patient_profiles p ON u.id = p.user_id
            WHERE u.id = $1 AND u.role = 'patient'
            `,
            [patientId]
        ),
        pool.query(
            `
            SELECT
                a.id,
                a.doctor_id,
                a.patient_id,
                a.start_time,
                a.end_time,
                a.notes,
                a.status,
                a.consultation_fee,
                a.payment_amount,
                a.payment_status,
                COALESCE(u.display_name, u.username) AS doctor_name,
                'active' AS source
            FROM appointments a
            LEFT JOIN users u ON u.id = a.doctor_id
            WHERE a.patient_id = $1
            ORDER BY a.start_time DESC
            `,
            [patientId]
        ),
        pool.query(
            `
            SELECT
                aa.id,
                aa.source_appointment_id,
                aa.doctor_id,
                aa.patient_id,
                aa.start_time,
                aa.end_time,
                aa.notes,
                aa.status,
                aa.consultation_fee,
                aa.payment_amount,
                aa.payment_status,
                aa.archived_at,
                COALESCE(u.display_name, u.username) AS doctor_name,
                'archived' AS source
            FROM appointment_archive aa
            LEFT JOIN users u ON u.id = aa.doctor_id
            WHERE aa.patient_id = $1
            ORDER BY aa.archived_at DESC
            `,
            [patientId]
        ),
        pool.query(
            `
            SELECT
                cn.id,
                cn.patient_id,
                cn.appointment_id,
                cn.doctor_id,
                cn.note,
                cn.created_at,
                cn.updated_at,
                COALESCE(u.display_name, u.username) AS doctor_name,
                u.avatar_url AS doctor_avatar_url
            FROM consultation_notes cn
            LEFT JOIN users u ON u.id = cn.doctor_id
            WHERE cn.patient_id = $1
            ORDER BY cn.created_at DESC
            `,
            [patientId]
        )
    ]);

    // Merge active and archived appointments, newest first.
    const appointments = [...activeRes.rows, ...archivedRes.rows].sort(
        (a, b) => new Date(b.start_time || b.archived_at) - new Date(a.start_time || a.archived_at)
    );

    const completedCount = appointments.filter((a) => a.status === "completed").length;
    const cancelledCount = appointments.filter((a) => ["cancelled", "declined", "no_show"].includes(a.status)).length;
    const pendingCount = appointments.length - completedCount - cancelledCount;

    const lastVisit = appointments.find(
        (a) => a.status === "completed" && new Date(a.start_time).getTime() > 0
    );

    const totalPaid = appointments.reduce((sum, a) => {
        const amount = Number(a.payment_amount);
        return sum + (Number.isFinite(amount) ? amount : 0);
    }, 0);

    return {
        patient: patientRes.rows[0] || null,
        appointments,
        notes: notesRes.rows,
        summary: {
            totalAppointments: appointments.length,
            completedAppointments: completedCount,
            cancelledAppointments: cancelledCount,
            pendingAppointments: pendingCount,
            consultationNotes: notesRes.rows.length,
            lastVisit: lastVisit ? lastVisit.start_time : null,
            lastVisitDoctor: lastVisit ? lastVisit.doctor_name : null,
            totalPaid: Math.round(totalPaid * 100) / 100,
        },
        generatedAt: new Date().toISOString(),
    };
}

// Newest stored AI report summary for a patient, used to serve the weekly
// summary without spending another model call (see patient_report_summaries.sql).
export async function getLatestPatientReportSummary(patientId) {
    const { rows } = await pool.query(
        `
        SELECT id, summary, generated_by, generated_at
        FROM patient_report_summaries
        WHERE patient_id = $1
        ORDER BY generated_at DESC
        LIMIT 1
        `,
        [patientId]
    );
    return rows[0] || null;
}

export async function insertPatientReportSummary(patientId, summary, generatedBy) {
    const { rows } = await pool.query(
        `
        INSERT INTO patient_report_summaries (patient_id, summary, generated_by)
        VALUES ($1, $2, $3)
        RETURNING id, generated_at
        `,
        [patientId, summary, generatedBy || null]
    );
    return rows[0];
}