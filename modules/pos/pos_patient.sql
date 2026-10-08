-- POS Patient Linking Schema
--
-- Links a sale to a registered patient so it shows up in that patient's
-- "My Orders" tracker. customer_name keeps working as the manual/walk-in
-- field; when it is blank the patient's name is stored instead.
--
-- Run this once against the database.

ALTER TABLE sales ADD COLUMN IF NOT EXISTS patient_id INT REFERENCES users(id) ON DELETE SET NULL;

-- voidSale() writes this column; IF NOT EXISTS keeps the migration a no-op
-- on databases that already have it.
ALTER TABLE sales ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_sales_patient_id ON sales(patient_id, created_at DESC);
