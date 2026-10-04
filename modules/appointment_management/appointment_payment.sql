-- Appointment Half-Payment Proof Schema
--
-- Patients must attach proof of a half-down payment when they request an
-- appointment. The image is stored as BYTEA so it survives redeploys (the
-- production backend runs on Render, where local disk is ephemeral).
--
-- An admin must review and verify the proof before the appointment can be
-- moved to 'scheduled' (approved).
--
-- Run this once against the database.

-- payment_status values:
--   unsubmitted -> appointment was created by an admin on the patient's behalf
--                  (no proof is required in that flow)
--   submitted   -> patient uploaded a proof image, waiting for admin review
--   verified    -> admin reviewed the image and confirmed the payment
--   rejected    -> admin sent the proof back; approval is blocked

DO $$ BEGIN CREATE TYPE appointment_payment_status AS ENUM ('unsubmitted', 'submitted', 'verified', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE appointments
    ADD COLUMN IF NOT EXISTS payment_proof BYTEA,
    ADD COLUMN IF NOT EXISTS payment_proof_mime VARCHAR(50),
    ADD COLUMN IF NOT EXISTS payment_proof_filename VARCHAR(255),
    ADD COLUMN IF NOT EXISTS consultation_fee NUMERIC(10, 2),
    ADD COLUMN IF NOT EXISTS payment_amount NUMERIC(10, 2),
    ADD COLUMN IF NOT EXISTS payment_status appointment_payment_status NOT NULL DEFAULT 'unsubmitted',
    ADD COLUMN IF NOT EXISTS payment_rejection_reason TEXT,
    ADD COLUMN IF NOT EXISTS payment_verified_by INT REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS payment_verified_at TIMESTAMP;

-- Keep the proof in the history log too, so archived (declined / no-show)
-- appointments can still show what was paid.
ALTER TABLE appointment_archive
    ADD COLUMN IF NOT EXISTS payment_proof BYTEA,
    ADD COLUMN IF NOT EXISTS payment_proof_mime VARCHAR(50),
    ADD COLUMN IF NOT EXISTS payment_proof_filename VARCHAR(255),
    ADD COLUMN IF NOT EXISTS consultation_fee NUMERIC(10, 2),
    ADD COLUMN IF NOT EXISTS payment_amount NUMERIC(10, 2),
    ADD COLUMN IF NOT EXISTS payment_status appointment_payment_status NOT NULL DEFAULT 'unsubmitted',
    ADD COLUMN IF NOT EXISTS payment_rejection_reason TEXT,
    ADD COLUMN IF NOT EXISTS payment_verified_by INT,
    ADD COLUMN IF NOT EXISTS payment_verified_at TIMESTAMP;

-- Appointments that still need an admin to look at their payment proof.
CREATE INDEX IF NOT EXISTS idx_appointments_payment_status
    ON appointments(payment_status)
    WHERE payment_status = 'submitted';