-- Review flags (MVP document 8.6) and doctor-entered clinical records (6.2.8).

-- Flags are computed by reconciliation from the confirmed history and are never
-- resolved automatically. A doctor marks a flag resolved with a note; a flag the
-- records no longer produce (for example after a correction) is "cleared".
CREATE TABLE record_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  type text NOT NULL CHECK (type IN (
    'contradiction', 'duplicate', 'missing_field', 'ambiguous_date',
    'orphan_reference', 'stale_medication', 'active_after_stop'
  )),
  message text NOT NULL,
  finding_ids uuid[] NOT NULL DEFAULT '{}',
  document_ids uuid[] NOT NULL DEFAULT '{}',
  -- type + the findings/documents involved: the same problem keeps the same row across re-runs.
  fingerprint char(64) NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'cleared')),
  resolution_note text,
  resolved_by_doctor_id uuid REFERENCES doctors(id) ON DELETE RESTRICT,
  resolved_at timestamptz,
  cleared_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (patient_id, fingerprint),
  CHECK (status <> 'resolved' OR (resolved_by_doctor_id IS NOT NULL AND resolved_at IS NOT NULL))
);
CREATE INDEX record_flags_patient_status_idx ON record_flags (patient_id, status);

-- A record a doctor adds (6.2.8). The record itself is the source of its findings,
-- so the quote verifier does not apply. Nothing earlier is changed.
CREATE TABLE clinical_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  doctor_id uuid NOT NULL REFERENCES doctors(id) ON DELETE RESTRICT,
  consultation_date date NOT NULL,
  facility text CHECK (facility IS NULL OR length(facility) <= 200),
  observations text CHECK (observations IS NULL OR length(observations) <= 4000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX clinical_records_patient_idx ON clinical_records (patient_id, consultation_date DESC);

CREATE FUNCTION prevent_clinical_record_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Clinical records are append-only; add a new record instead';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER clinical_records_append_only
BEFORE UPDATE OR DELETE ON clinical_records
FOR EACH ROW EXECUTE FUNCTION prevent_clinical_record_mutation();

ALTER TABLE claims ADD COLUMN clinical_record_id uuid REFERENCES clinical_records(id) ON DELETE RESTRICT;
ALTER TABLE claims
  ADD CONSTRAINT claims_doctor_entered_has_record
  CHECK (source_type <> 'doctor_entered' OR clinical_record_id IS NOT NULL) NOT VALID; -- new rows only; older test rows predate clinical records
CREATE INDEX claims_clinical_record_idx ON claims (clinical_record_id) WHERE clinical_record_id IS NOT NULL;
