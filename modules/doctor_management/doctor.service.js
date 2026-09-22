// doctor.service.js
import pool from "../../shared/config/db.js";

/**
 * Get all doctor profiles joined with user details
 */
export async function getAllDoctorProfiles(limit = 10, offset = 0) {
  const result = await pool.query(
    `
    SELECT 
      u.id AS user_id,
      u.email,
      u.username,
      u.display_name,
      u.avatar_url,
      u.role,
      d.id AS profile_id,
      d.specialty,
      d.license_number,
      d.bio,
      d.consultation_fee,
      d.slot_duration_minutes,
      d.created_at,
      d.updated_at
    FROM users u
    INNER JOIN doctor_profiles d ON u.id = d.user_id
    ORDER BY d.created_at DESC
    LIMIT $1 OFFSET $2
    `,
    [limit, offset]
  );

  return result.rows;
}

/**
 * Get a single doctor profile and user data by user_id
 */
export async function getDoctorProfileByUserId(userId) {
  const result = await pool.query(
    `
    SELECT 
      u.id AS user_id,
      u.email,
      u.username,
      u.display_name,
      u.avatar_url,
      u.role,
      d.id AS profile_id,
      d.specialty,
      d.license_number,
      d.bio,
      d.consultation_fee,
      d.slot_duration_minutes,
      d.created_at,
      d.updated_at
    FROM users u
    INNER JOIN doctor_profiles d ON u.id = d.user_id
    WHERE u.id = $1
    `,
    [userId]
  );

  return result.rows[0] || null;
}

/**
 * Create a new doctor profile entry
 */
export async function createDoctorProfile(profileData) {
  const {
    userId,
    specialty,
    licenseNumber,
    bio,
    consultationFee,
    slotDurationMinutes = 30,
  } = profileData;

  const result = await pool.query(
    `
    INSERT INTO doctor_profiles (
      user_id,
      specialty,
      license_number,
      bio,
      consultation_fee,
      slot_duration_minutes
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
    `,
    [
      userId,
      specialty || null,
      licenseNumber || null,
      bio || null,
      consultationFee || null,
      slotDurationMinutes,
    ]
  );

  return result.rows[0];
}

/**
 * Update doctor profile fields using COALESCE to keep existing values if null/undefined
 */
export async function updateDoctorProfile(userId, profileData) {
  const {
    specialty,
    licenseNumber,
    bio,
    consultationFee,
    slotDurationMinutes,
  } = profileData;

  const result = await pool.query(
    `
    UPDATE doctor_profiles
    SET 
      specialty = COALESCE($1, specialty),
      license_number = COALESCE($2, license_number),
      bio = COALESCE($3, bio),
      consultation_fee = COALESCE($4, consultation_fee),
      slot_duration_minutes = COALESCE($5, slot_duration_minutes),
      updated_at = CURRENT_TIMESTAMP
    WHERE user_id = $6
    RETURNING *
    `,
    [
      specialty || null,
      licenseNumber || null,
      bio || null,
      consultationFee || null,
      slotDurationMinutes || null,
      userId,
    ]
  );

  return result.rows[0] || null;
}

/**
 * Delete doctor profile by user_id
 */
export async function deleteDoctorProfileByUserId(userId) {
  const result = await pool.query(
    `
    DELETE FROM doctor_profiles
    WHERE user_id = $1
    RETURNING *
    `,
    [userId]
  );

  return result.rows[0] || null;
}


/**
 * Get schedules for a specific doctor by user_id ordered by day_of_week
 */
export async function getDoctorSchedulesByUserId(userId) {
  const result = await pool.query(
    `
    SELECT id, doctor_id, day_of_week, start_time, end_time, is_active
    FROM doctor_schedules
    WHERE doctor_id = $1
    ORDER BY day_of_week ASC
    `,
    [userId]
  );
  return result.rows;
}

/**
 * Replace all schedules for a doctor within a database transaction
 * @param {number|string} userId 
 * @param {Array<{dayOfWeek: number, startTime: string, endTime: string, isActive: boolean}>} schedules 
 */
export async function setDoctorSchedules(userId, schedules) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Clear existing schedules for this doctor
    await client.query("DELETE FROM doctor_schedules WHERE doctor_id = $1", [userId]);

    // 2. Insert new schedule records
    const insertedSchedules = [];
    for (const schedule of schedules) {
      const { dayOfWeek, startTime, endTime, isActive = true } = schedule;

      // Skip inactive entries or validate time boundaries
      if (!isActive) continue;

      const res = await client.query(
        `
        INSERT INTO doctor_schedules (doctor_id, day_of_week, start_time, end_time, is_active)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
        `,
        [userId, dayOfWeek, startTime, endTime, isActive]
      );
      insertedSchedules.push(res.rows[0]);
    }

    await client.query("COMMIT");
    return insertedSchedules;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}