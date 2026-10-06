-- Appointment "In Consultation" (ongoing) Status
--
-- The doctor portal lets a doctor mark their own appointment as
-- 'in_consultation' (consultation ongoing) and then 'completed'.
--
-- appointments.status / appointment_archive.status are plain VARCHAR columns,
-- so the new value normally needs no schema change. The DO block below only
-- exists for databases created with a CHECK constraint on status: it drops any
-- check constraint that covers the status column so 'in_consultation' can be
-- stored. It is a no-op when no such constraint exists.
--
-- Run this once against the database.

DO $$
DECLARE
    cons RECORD;
BEGIN
    FOR cons IN
        SELECT c.conname
        FROM pg_constraint c
        JOIN pg_attribute a
          ON a.attrelid = c.conrelid
         AND a.attnum = ANY (c.conkey)
        WHERE c.conrelid = 'appointments'::regclass
          AND c.contype = 'c'
          AND a.attname = 'status'
    LOOP
        EXECUTE format('ALTER TABLE appointments DROP CONSTRAINT %I', cons.conname);
    END LOOP;
END $$;
