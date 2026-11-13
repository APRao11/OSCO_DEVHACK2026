-- Doctors viewing and correcting patient records under consent (MVP document 6.1.1, 6.2, 7.1, 7.3).

-- Public Patient ID (6.1.1): OSCO- + 8 characters from a 32-character alphabet without
-- look-alikes (no 0, O, 1, I). Built from gen_random_uuid(), which uses a strong random
-- source, never from a counter or personal data. The internal UUID stays the primary key.
CREATE FUNCTION osco_new_patient_public_id() RETURNS text AS $$
DECLARE
  alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  bytes bytea := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
  result text := 'OSCO-';
BEGIN
  FOR i IN 0..7 LOOP
    result := result || substr(alphabet, (get_byte(bytes, i) % 32) + 1, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql VOLATILE;

ALTER TABLE patients ADD COLUMN public_id text;
UPDATE patients SET public_id = osco_new_patient_public_id() WHERE public_id IS NULL;
ALTER TABLE patients
  ALTER COLUMN public_id SET DEFAULT osco_new_patient_public_id(),
  ALTER COLUMN public_id SET NOT NULL,
  ADD CONSTRAINT patients_public_id_format CHECK (public_id ~ '^OSCO-[2-9A-HJ-NP-Z]{8}$');
CREATE UNIQUE INDEX patients_public_id_unique ON patients (public_id);

-- Doctor corrections: a new row superseding the finding, like patient corrections.
ALTER TABLE claims DROP CONSTRAINT claims_source_type_check;
ALTER TABLE claims
  ADD CONSTRAINT claims_source_type_check
  CHECK (source_type IN ('ai_extracted', 'doctor_entered', 'patient_corrected', 'doctor_corrected'));
ALTER TABLE claims DROP CONSTRAINT claims_patient_correction_has_original;
ALTER TABLE claims
  ADD CONSTRAINT claims_correction_has_original
  CHECK (source_type NOT IN ('patient_corrected', 'doctor_corrected') OR supersedes_id IS NOT NULL);

-- Who made a correction, and who last changed the review state (remove / restore / confirm).
-- The audit log keeps the full history; these columns let the UI say "Corrected by Dr ...".
ALTER TABLE claims
  ADD COLUMN author_type text CHECK (author_type IN ('patient', 'doctor')),
  ADD COLUMN author_id uuid,
  ADD COLUMN reviewed_by_type text CHECK (reviewed_by_type IN ('patient', 'doctor')),
  ADD COLUMN reviewed_by_id uuid,
  -- The review state before a removal, so "restore" returns a finding to where it was.
  ADD COLUMN previous_review_status text CHECK (previous_review_status IN ('pending', 'confirmed'));
