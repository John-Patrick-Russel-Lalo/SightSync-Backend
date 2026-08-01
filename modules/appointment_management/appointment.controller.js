import { getAvailableSlots } from "./appointment.service.js";

export async function getAvailableSlotsController(req, res) {
    try {
        const { doctorId, selectedDate } = req.params;

        // 1. Validate doctorId
        const parsedDoctorId = parseInt(doctorId, 10);
        if (isNaN(parsedDoctorId)) {
            return res.status(400).json({ 
                message: "Invalid doctor ID. Must be a valid number." 
            });
        }

        // 2. Validate selectedDate format (YYYY-MM-DD)
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!selectedDate || !dateRegex.test(selectedDate)) {
            return res.status(400).json({ 
                message: "Invalid or missing date. Please use YYYY-MM-DD format." 
            });
        }

        // 3. Fetch slots
        const slots = await getAvailableSlots(parsedDoctorId, selectedDate);

        return res.status(200).json({
            message: "Available slots fetched successfully",
            slots: slots
        });
    } catch (error) {
        console.error("Error in getAvailableSlotsController:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
}