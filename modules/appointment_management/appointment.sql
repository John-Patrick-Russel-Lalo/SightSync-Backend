-- Appointment Management Schema
-- Declined and no-show appointments are moved to the archive (history logs)
-- so their time slots become available for rebooking.

CREATE TABLE IF NOT EXISTS appointment_archive (
    id SERIAL PRIMARY KEY,
    doctor_id INT REFERENCES users(id) ON DELETE SET NULL,
    patient_id INT REFERENCES users(id) ON DELETE SET NULL,
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    notes TEXT,
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    archived_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_appointment_archive_patient_id ON appointment_archive(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointment_archive_doctor_id ON appointment_archive(doctor_id);