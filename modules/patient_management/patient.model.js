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