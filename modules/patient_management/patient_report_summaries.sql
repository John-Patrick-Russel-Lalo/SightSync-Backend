-- Patient Report AI Summaries Schema
--
-- Each AI clinical overview generated for a patient's report is stored so the
-- same summary can be re-read for free. The API only calls the model again
-- once the newest row is older than 7 days (one generated summary per patient
-- per week).
--
-- Run this once against the database.

CREATE TABLE IF NOT EXISTS patient_report_summaries (
    id SERIAL PRIMARY KEY,
    patient_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    summary TEXT NOT NULL,
    generated_by INT REFERENCES users(id) ON DELETE SET NULL,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patient_report_summaries_patient_id
    ON patient_report_summaries(patient_id, generated_at DESC);
