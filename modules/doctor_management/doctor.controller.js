// doctor.controller.js
import {
    getAllDoctorProfiles,
    getDoctorProfileByUserId,
    createDoctorProfile,
    updateDoctorProfile,
    deleteDoctorProfileByUserId,
    getDoctorSchedulesByUserId,
    setDoctorSchedules,
} from "./doctor.service.js";

/**
 * GET /doctors
 * Get all doctor profiles (paginated)
 */
export async function handleGetAllDoctorProfiles(req, res) {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const offset = parseInt(req.query.offset) || 0;

        const doctors = await getAllDoctorProfiles(limit, offset);
        res.json({ data: doctors, limit, offset, count: doctors.length });
    } catch (error) {
        console.error("Error fetching all doctor profiles:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
}

/**
 * GET /doctors/:userId
 * Get a single doctor profile by user_id
 */
export async function handleGetDoctorProfileByUserId(req, res) {
    try {
        const { userId } = req.params;

        const doctor = await getDoctorProfileByUserId(userId);

        if (!doctor) {
            return res.status(404).json({ error: "Doctor profile not found." });
        }

        res.json({ data: doctor });
    } catch (error) {
        console.error("Error fetching doctor profile:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
}

/**
 * POST /doctors
 * Create a new doctor profile
 */
export async function handleCreateDoctorProfile(req, res) {
    try {
        const { userId, specialty, licenseNumber, bio, consultationFee, slotDurationMinutes } =
            req.body;

        console.log(req.body)

        // Basic validation
        if (!userId || !specialty || !licenseNumber) {
            return res.status(400).json({
                error: "Missing required fields: userId, specialty, and licenseNumber are required.",
            });
        }

        // Check if user already has a doctor profile
        const existingProfile = await getDoctorProfileByUserId(userId);
        if (existingProfile) {
            return res.status(400).json({
                error: "Doctor profile already exists for this user. Use update instead.",
            });
        }

        const newProfile = await createDoctorProfile({
            userId,
            specialty,
            licenseNumber,
            bio,
            consultationFee,
            slotDurationMinutes,
        });

        res.status(201).json({
            message: "Doctor profile created successfully.",
            data: newProfile,
        });
    } catch (error) {
        console.error("Error creating doctor profile:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
}

/**
 * PUT /doctors/:userId
 * Update doctor profile by user_id
 */
export async function handleUpdateDoctorProfile(req, res) {
    try {
        const { userId } = req.params;
        const profileData = req.body;

        // Check if doctor profile exists
        const existingProfile = await getDoctorProfileByUserId(userId);
        if (!existingProfile) {
            return res.status(404).json({ error: "Doctor profile not found." });
        }

        // Update profile using COALESCE (only updates provided fields)
        const updatedProfile = await updateDoctorProfile(userId, profileData);

        res.json({
            message: "Doctor profile updated successfully.",
            data: updatedProfile,
        });
    } catch (error) {
        console.error("Error updating doctor profile:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
}

/**
 * DELETE /doctors/:userId
 * Delete doctor profile by user_id
 */
export async function handleDeleteDoctorProfile(req, res) {
    try {
        const { userId } = req.params;

        // Check if doctor profile exists
        const existingProfile = await getDoctorProfileByUserId(userId);
        if (!existingProfile) {
            return res.status(404).json({ error: "Doctor profile not found." });
        }

        const deletedProfile = await deleteDoctorProfileByUserId(userId);

        res.json({
            message: "Doctor profile deleted successfully.",
            data: deletedProfile,
        });
    } catch (error) {
        console.error("Error deleting doctor profile:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
}

export async function getDoctorSchedulesController(req, res) {
  try {
    const { userId } = req.params;
    const schedules = await getDoctorSchedulesByUserId(userId);
    res.status(200).json({ success: true, data: schedules });
  } catch (error) {
    console.error("Error fetching doctor schedules:", error);
    res.status(500).json({ error: "Failed to load doctor schedules." });
  }
}

export async function setDoctorSchedulesController(req, res) {
  try {
    const { userId } = req.params;
    const { schedules } = req.body; // Expects an array of schedule items

    if (!Array.isArray(schedules)) {
      return res.status(400).json({ error: "schedules payload must be an array." });
    }

    const updatedSchedules = await setDoctorSchedules(userId, schedules);
    res.status(200).json({
      success: true,
      message: "Doctor schedule updated successfully.",
      data: updatedSchedules,
    });
  } catch (error) {
    console.error("Error updating doctor schedule:", error);
    res.status(500).json({ error: error.message || "Failed to update schedules." });
  }
}