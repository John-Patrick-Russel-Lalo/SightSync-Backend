-- Consultation Notes Schema
--
-- Doctors write notes about a patient while consulting them. Notes live in
-- their own table instead of on the appointment row so they survive the
-- archive flow (declined / no-show appointments are deleted from
-- appointments and moved to appointment_archive).
--
-- Run this once against the database.

CREATE TABLE IF NOT EXISTS consultation_notes (
    id SERIAL PRIMARY KEY,
    patient_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    appointment_id INT REFERENCES appointments(id) ON DELETE SET NULL,
    doctor_id INT REFERENCES users(id) ON DELETE SET NULL,
    note TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_consultation_notes_patient_id ON consultation_notes(patient_id);
CREATE INDEX IF NOT EXISTS idx_consultation_notes_appointment_id ON consultation_notes(appointment_id);
