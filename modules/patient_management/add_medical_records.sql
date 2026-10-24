-- Add medical record fields to patient_profiles
ALTER TABLE patient_profiles
ADD COLUMN IF NOT EXISTS case_history TEXT,
ADD COLUMN IF NOT EXISTS chief_complaint TEXT,
ADD COLUMN IF NOT EXISTS objective_findings TEXT,
ADD COLUMN IF NOT EXISTS pupillary_distance VARCHAR(50),
ADD COLUMN IF NOT EXISTS unaided_visual_acuity VARCHAR(50),
ADD COLUMN IF NOT EXISTS best_corrected_visual_acuity VARCHAR(50),
ADD COLUMN IF NOT EXISTS prescription_rx TEXT;
