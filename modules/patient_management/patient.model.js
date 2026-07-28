import pool from "../../shared/config/db.js";

// Fetch user account info along with their patient profile
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
            p.updated_at
        FROM users u
        INNER JOIN patient_profiles p ON u.id = p.user_id
        WHERE u.id = $1
        `,
        [userId]
    );

    return result.rows[0] || null;
}

// Update the existing profile shell created during signup
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

    const result = await pool.query(
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

    return result.rows[0];
}