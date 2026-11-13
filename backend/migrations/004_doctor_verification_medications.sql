-- Doctor verification status (MVP document sections 5.3 and 7.1) and the
-- curated medication histories built by reconciliation (section 8.6).

ALTER TABLE doctors
  ADD COLUMN verification_status text NOT NULL DEFAULT 'pending'
    CHECK (verification_status IN ('pending', 'verified', 'rejected', 'revoked')),
  ADD COLUMN verified_at timestamptz,
  ADD COLUMN revoked_at timestamptz;

-- Revoking (or otherwise un-verifying) a doctor ends that doctor's active
-- access sessions in the same transaction, whichever code path changes the status.
-- now() is the transaction start, so it satisfies the "revoked_at not in the future" rule.
CREATE FUNCTION end_access_when_doctor_unverified() RETURNS trigger AS $$
BEGIN
  IF OLD.verification_status = 'verified' AND NEW.verification_status <> 'verified' THEN
    UPDATE doctor_access_sessions
    SET revoked_at = now()
    WHERE doctor_id = NEW.id
      AND revoked_at IS NULL
      AND expires_at > now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER doctors_end_access_on_unverify
AFTER UPDATE OF verification_status ON doctors
FOR EACH ROW EXECUTE FUNCTION end_access_when_doctor_unverified();

-- CURATED layer: rebuilt by reconciliation from accepted claims, so it can be
-- replaced on every run. The evidence it points to (claims) is never changed.
CREATE TABLE medication_histories (
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  drug text NOT NULL,
  history jsonb NOT NULL,
  computed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (patient_id, drug)
);
