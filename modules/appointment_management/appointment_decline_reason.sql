-- Appointment Decline Reason Schema
--
-- When an admin declines (or cancels) an appointment, they can attach a note
-- explaining why. The note is persisted with the appointment, copied into the
-- archive when the row is moved there, included in the patient notification,
-- and shown to the patient in their appointment archive.
--
-- Run this once against the database.

ALTER TABLE appointments
    ADD COLUMN IF NOT EXISTS decline_reason TEXT;

ALTER TABLE appointment_archive
    ADD COLUMN IF NOT EXISTS decline_reason TEXT;
