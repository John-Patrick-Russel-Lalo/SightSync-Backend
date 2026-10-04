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

-- Which appointments row an archive entry came from. appointment_archive has its
-- own SERIAL id, so without this the archive cannot tell an original booking
-- apart from a repeat entry for the same booking - which is how the automatic
-- no-show job ended up archiving and notifying the same expired appointment
-- again on every run.
ALTER TABLE appointment_archive
    ADD COLUMN IF NOT EXISTS source_appointment_id INT;

-- One archive entry per appointment, ever. Both the automatic no-show job and
-- the manual status update lean on this to stay idempotent: the second attempt
-- conflicts and is dropped instead of notifying the patient and doctor twice.
CREATE UNIQUE INDEX IF NOT EXISTS idx_appointment_archive_source_appointment
    ON appointment_archive(source_appointment_id)
    WHERE source_appointment_id IS NOT NULL;