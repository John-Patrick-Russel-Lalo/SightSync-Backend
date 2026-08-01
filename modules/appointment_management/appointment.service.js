import pool from "../../shared/config/db.js";

// Helper Functions
function timeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(":").map(Number);
    return hours * 60 + minutes;
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

function extractTimeString(dateVal) {
    if (typeof dateVal === "string" && dateVal.includes(":")) {
        return dateVal.includes("T")
            ? dateVal.split("T")[1].substring(0, 8)
            : dateVal.substring(0, 8);
    }
    const date = new Date(dateVal);
    return date.toTimeString().split(" ")[0];
}

export async function getAvailableSlots(doctorId, selectedDate) {
    // 1. Fetch Doctor Shift / Working Hours (Prioritizing Overrides)
    const shiftResult = await pool.query(
        `
        SELECT 
            COALESCE(o.start_time, s.start_time) AS start_time,
            COALESCE(o.end_time, s.end_time) AS end_time,
            COALESCE(o.is_unavailable, FALSE) AS is_unavailable,
            dp.slot_duration_minutes
        FROM doctor_profiles dp
        LEFT JOIN doctor_schedule_overrides o 
            ON o.doctor_id = dp.user_id 
            AND o.override_date = $2
        LEFT JOIN doctor_schedules s 
            ON s.doctor_id = dp.user_id 
            AND s.day_of_week = EXTRACT(DOW FROM $2::date)
            AND s.is_active = TRUE
        WHERE dp.user_id = $1 
            AND (o.id IS NOT NULL OR s.id IS NOT NULL)
        `,
        [doctorId, selectedDate]
    );

    const shift = shiftResult.rows[0];

    // Doctor is off or not working on this date
    if (!shift || shift.is_unavailable || !shift.start_time || !shift.end_time) {
        return [];
    }

    // 2. Fetch existing appointments for doctor on selected date
    const bookedResult = await pool.query(
        `
        SELECT 
            start_time, 
            end_time 
        FROM appointments 
        WHERE doctor_id = $1 
            AND DATE(start_time) = $2 
            AND status NOT IN ('cancelled', 'no_show')
        `,
        [doctorId, selectedDate]
    );

    const bookedAppointments = bookedResult.rows.map((appt) => ({
        start: timeToMinutes(extractTimeString(appt.start_time)),
        end: timeToMinutes(extractTimeString(appt.end_time))
    }));

    // 3. Calculate free time slots
    const slotDuration = shift.slot_duration_minutes || 30;
    const shiftStartMin = timeToMinutes(shift.start_time);
    const shiftEndMin = timeToMinutes(shift.end_time);

    const availableSlots = [];
    let currentSlotStart = shiftStartMin;

    while (currentSlotStart + slotDuration <= shiftEndMin) {
        const currentSlotEnd = currentSlotStart + slotDuration;

        // Check if current slot conflicts with existing appointments
        const isBooked = bookedAppointments.some((appt) => {
            return currentSlotStart < appt.end && currentSlotEnd > appt.start;
        });

        if (!isBooked) {
            availableSlots.push(minutesToTime(currentSlotStart));
        }

        currentSlotStart += slotDuration;
    }

    return availableSlots;
}