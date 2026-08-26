import * as PatientModel from "./patient.model.js";
import { phoneNumberValidator } from "./patient.service.js";

// GET /api/patient/me
export async function getMyProfile(req, res) {
    try {
        // Assume req.user.id is populated by your authentication middleware
        const userId = req.user.id; 
        
        const profile = await PatientModel.getPatientProfileByUserId(userId);

        if (!profile) {
            return res.status(404).json({ message: "Patient profile not found." });
        }

        return res.status(200).json({
            success: true,
            data: profile
        });
    } catch (error) {
        return res.status(500).json({ 
            success: false, 
            message: "Failed to retrieve profile.", 
            error: error.message 
        });
    }
}

export async function updateMyPatientProfile(req, res, next) {
    try {
        const userId = req.user.id;

        const isAdmin = req.user.role === "admin";
        console.log(isAdmin)

        phoneNumberValidator(req, res);

        const updatedProfile = await PatientModel.updatePatientProfileByUser(
            userId,
            req.body,
            isAdmin
        );

        return res.status(200).json({
            message: "Patient profile updated successfully.",
            data: updatedProfile
        });
    } catch (error) {
        next(error);
    }
}

// PUT /api/patient/me
export async function updateProfile(req, res) {
    try {
        const userId = req.body.id;

        phoneNumberValidator(req, res);

        
        const updatedProfile = await PatientModel.updatePatientProfile(userId, req.body);

        if (!updatedProfile) {
            return res.status(404).json({ message: "Patient profile update failed. Profile not found." });
        }

        return res.status(200).json({
            success: true,
            message: "Patient profile updated successfully.",
            data: updatedProfile
        });
    } catch (error) {
        return res.status(500).json({ 
            success: false, 
            message: "Failed to update profile.", 
            error: error.message 
        });
    }
}