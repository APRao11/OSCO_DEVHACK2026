-- Patient review of extracted findings before they enter the medical history.
--
-- review_status: pending   -> extracted, waiting for the patient
--                confirmed -> added to the medical history and timeline
--                dismissed -> removed by the patient ("wrong" / "not mine"); kept, never shown
--
-- A patient edit is a NEW row (source_type 'patient_corrected', supersedes_id = the
-- row it replaces). The original row and its document quote are kept (append-only,
-- MVP document 7.3 rule 8) and marked verification_status = 'corrected'.

ALTER TABLE claims
  ADD COLUMN review_status text NOT NULL DEFAULT 'pending'
    CHECK (review_status IN ('pending', 'confirmed', 'dismissed')),
  ADD COLUMN reviewed_at timestamptz;

ALTER TABLE claims DROP CONSTRAINT claims_source_type_check;
ALTER TABLE claims
  ADD CONSTRAINT claims_source_type_check
  CHECK (source_type IN ('ai_extracted', 'doctor_entered', 'patient_corrected'));

-- A patient correction always points at the finding it corrects.
ALTER TABLE claims
  ADD CONSTRAINT claims_patient_correction_has_original
  CHECK (source_type <> 'patient_corrected' OR supersedes_id IS NOT NULL);

CREATE INDEX claims_supersedes_idx ON claims (supersedes_id) WHERE supersedes_id IS NOT NULL;
CREATE INDEX claims_patient_review_idx ON claims (patient_id, review_status) WHERE retired_at IS NULL;
