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
        emergencyContactPhone
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
                profile_edit_count = CASE
                    WHEN $7 = FALSE THEN profile_edit_count + 1
                    ELSE profile_edit_count
                END,
                updated_at = CURRENT_TIMESTAMP
            WHERE user_id = $8
            RETURNING *
            `,
            [
                dateOfBirth || null,
                gender || null,
                phoneNumber || null,
                bloodType || null,
                emergencyContactName || null,
                emergencyContactPhone || null,
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
        emergencyContactPhone
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
                updated_at = CURRENT_TIMESTAMP
            WHERE user_id = $7
            RETURNING *
            `,
            [
                dateOfBirth || null,
                gender || null,
                phoneNumber || null,
                bloodType || null,
                emergencyContactName || null,
                emergencyContactPhone || null,
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
// (active and archived) with the attending doctor's name, the patient's
// consultation-note history, and the POS store purchases linked to them.
// Used by the admin and doctor portals.
export async function getPatientReport(patientId) {
    const [patientRes, activeRes, archivedRes, notesRes, salesRes] = await Promise.all([
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
        ),
        // Store purchases (POS) linked to this registered patient. Keeps the
        // clinical summary in sync with what the patient actually bought.
        pool.query(
            `
            SELECT
                s.id,
                s.receipt_number,
                s.customer_name,
                s.subtotal,
                s.discount_amount,
                s.tax_amount,
                s.total,
                s.payment_method,
                s.status,
                s.created_at,
                COALESCE(u.display_name, u.username) AS sold_by_name
            FROM sales s
            LEFT JOIN users u ON u.id = s.sold_by
            WHERE s.patient_id = $1
            ORDER BY s.created_at DESC
            `,
            [patientId]
        )
    ]);

    // Attach each receipt's line items in one batch.
    let orders = [];
    if (salesRes.rows.length > 0) {
        const itemsRes = await pool.query(
            `
            SELECT id, sale_id, inventory_id, sku, product_name, category, unit_price, quantity, line_total
            FROM sale_items
            WHERE sale_id = ANY($1::int[])
            ORDER BY id
            `,
            [salesRes.rows.map((sale) => sale.id)]
        );

        const itemsBySale = new Map();
        for (const item of itemsRes.rows) {
            const list = itemsBySale.get(item.sale_id) || [];
            list.push(item);
            itemsBySale.set(item.sale_id, list);
        }

        orders = salesRes.rows.map((sale) => ({
            ...sale,
            items: itemsBySale.get(sale.id) || [],
        }));
    }

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

    const completedOrders = orders.filter((o) => o.status === "completed");
    const totalOrderSpend = completedOrders.reduce((sum, o) => {
        const amount = Number(o.total);
        return sum + (Number.isFinite(amount) ? amount : 0);
    }, 0);

    return {
        patient: patientRes.rows[0] || null,
        appointments,
        notes: notesRes.rows,
        orders,
        summary: {
            totalAppointments: appointments.length,
            completedAppointments: completedCount,
            cancelledAppointments: cancelledCount,
            pendingAppointments: pendingCount,
            consultationNotes: notesRes.rows.length,
            lastVisit: lastVisit ? lastVisit.start_time : null,
            lastVisitDoctor: lastVisit ? lastVisit.doctor_name : null,
            totalPaid: Math.round(totalPaid * 100) / 100,
            totalOrders: orders.length,
            completedOrders: completedOrders.length,
            totalOrderSpend: Math.round(totalOrderSpend * 100) / 100,
            totalSpend: Math.round((totalPaid + totalOrderSpend) * 100) / 100,
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