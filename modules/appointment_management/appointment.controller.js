import { getAvailableSlots, createAppointment } from "./appointment.service.js";

export async function handleGetAvailableSlots(req, res) {
    try {
        const { doctorId, date } = req.params;

        if (!doctorId || !date) {
            return res.status(400).json({
                error: "doctorId path parameter and 'date' query parameter (YYYY-MM-DD) are required."
            });
        }

        const slots = await getAvailableSlots(doctorId, date);
        return res.json({ doctorId, date, availableSlots: slots });
    } catch (error) {
        console.error("Error fetching available slots:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
}

export async function handleCreateAppointment(req, res) {
    try {
        const { doctorId, patientId, date, slot, notes } = req.body;

        if (!doctorId || !patientId || !date || !slot) {
            return res.status(400).json({
                error: "doctorId, patientId, date (YYYY-MM-DD), and slot (HH:MM) are required."
            });
        }

        const result = await createAppointment({
            doctorId,
            patientId,
            date,
            slot,
            notes
        });

        if (!result.success) {
            return res.status(result.statusCode).json({ error: result.message });
        }

        return res.status(201).json({
            message: "Appointment successfully created.",
            appointment: result.data
        });
    } catch (error) {
        if (error.code === '23503') {
            return res.status(400).json({ 
                error: "Invalid doctorId or patientId. The specified user does not exist." 
            });
        }
        console.error("Error creating appointment:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
}