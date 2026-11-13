-- Tighten existing consent data without rewriting the already-versioned initial migration.
ALTER TABLE doctor_access_requests
  ADD CONSTRAINT doctor_access_requests_decision_integrity_check
  CHECK (
    (status = 'pending'
      AND approved_access IS NULL
      AND decided_by_patient_id IS NULL
      AND decided_at IS NULL)
    OR (status = 'approved'
      AND approved_access IS NOT NULL
      AND decided_by_patient_id IS NOT NULL
      AND decided_by_patient_id = patient_id
      AND decided_at IS NOT NULL)
    OR (status = 'denied'
      AND approved_access IS NULL
      AND decided_by_patient_id IS NOT NULL
      AND decided_by_patient_id = patient_id
      AND decided_at IS NOT NULL)
  );

CREATE FUNCTION protect_doctor_access_request() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Doctor access requests are retained as consent history';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status IS DISTINCT FROM 'pending'
      OR NEW.approved_access IS NOT NULL
      OR NEW.decided_by_patient_id IS NOT NULL
      OR NEW.decided_at IS NOT NULL
      OR NEW.requested_at > statement_timestamp()
      OR NEW.expires_at <= statement_timestamp() THEN
      RAISE EXCEPTION 'Access requests must be created pending and unexpired';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.patient_id IS DISTINCT FROM NEW.patient_id
    OR OLD.doctor_id IS DISTINCT FROM NEW.doctor_id
    OR OLD.purpose IS DISTINCT FROM NEW.purpose
    OR OLD.requested_access IS DISTINCT FROM NEW.requested_access
    OR OLD.requested_at IS DISTINCT FROM NEW.requested_at
    OR OLD.expires_at IS DISTINCT FROM NEW.expires_at THEN
    RAISE EXCEPTION 'Access request details are immutable';
  END IF;

  IF OLD.status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'A decided access request cannot be changed';
  END IF;

  IF NEW.status IS DISTINCT FROM 'pending' THEN
    IF OLD.expires_at <= statement_timestamp() THEN
      RAISE EXCEPTION 'An expired access request cannot be decided';
    END IF;
    IF NEW.decided_by_patient_id IS NULL
      OR NEW.decided_by_patient_id IS DISTINCT FROM NEW.patient_id
      OR NEW.decided_at IS NULL
      OR NEW.decided_at < OLD.requested_at
      OR NEW.decided_at > statement_timestamp() THEN
      RAISE EXCEPTION 'A decision must be recorded by the owning patient at decision time';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER doctor_access_request_consent_integrity
BEFORE INSERT OR UPDATE OR DELETE ON doctor_access_requests
FOR EACH ROW EXECUTE FUNCTION protect_doctor_access_request();

CREATE OR REPLACE FUNCTION require_patient_approved_access() RETURNS trigger AS $$
DECLARE
  access_request doctor_access_requests%ROWTYPE;
BEGIN
  SELECT * INTO access_request
  FROM doctor_access_requests
  WHERE id = NEW.request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Access session request does not exist';
  END IF;

  IF access_request.status IS DISTINCT FROM 'approved'
    OR access_request.patient_id IS DISTINCT FROM NEW.patient_id
    OR access_request.doctor_id IS DISTINCT FROM NEW.doctor_id
    OR access_request.approved_access IS DISTINCT FROM NEW.access_level
    OR access_request.decided_by_patient_id IS NULL
    OR access_request.decided_by_patient_id IS DISTINCT FROM NEW.approved_by_patient_id
    OR access_request.decided_by_patient_id IS DISTINCT FROM NEW.patient_id
    OR access_request.decided_at IS NULL
    OR access_request.expires_at <= statement_timestamp() THEN
    RAISE EXCEPTION 'Access session requires a matching, unexpired patient-approved request';
  END IF;

  IF NEW.started_at > statement_timestamp()
    OR NEW.expires_at <= statement_timestamp() THEN
    RAISE EXCEPTION 'Access session must start now and have a future expiry';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION protect_doctor_access_session() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Doctor access sessions are retained as access history';
  END IF;

  IF OLD.id IS DISTINCT FROM NEW.id
    OR OLD.request_id IS DISTINCT FROM NEW.request_id
    OR OLD.patient_id IS DISTINCT FROM NEW.patient_id
    OR OLD.doctor_id IS DISTINCT FROM NEW.doctor_id
    OR OLD.access_level IS DISTINCT FROM NEW.access_level
    OR OLD.approved_by_patient_id IS DISTINCT FROM NEW.approved_by_patient_id
    OR OLD.started_at IS DISTINCT FROM NEW.started_at
    OR OLD.expires_at IS DISTINCT FROM NEW.expires_at THEN
    RAISE EXCEPTION 'Access session identity, permission, and expiry are immutable';
  END IF;

  IF OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS DISTINCT FROM OLD.revoked_at THEN
    RAISE EXCEPTION 'A revoked access session cannot be reactivated or re-dated';
  END IF;
  IF OLD.revoked_at IS NULL
    AND NEW.revoked_at IS NOT NULL
    AND NEW.revoked_at > statement_timestamp() THEN
    RAISE EXCEPTION 'A revocation timestamp cannot be in the future';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER doctor_access_session_integrity
BEFORE UPDATE OR DELETE ON doctor_access_sessions
FOR EACH ROW EXECUTE FUNCTION protect_doctor_access_session();

CREATE FUNCTION prevent_access_history_truncate() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Doctor access and consent history cannot be truncated';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER doctor_access_requests_no_truncate
BEFORE TRUNCATE ON doctor_access_requests
FOR EACH STATEMENT EXECUTE FUNCTION prevent_access_history_truncate();

CREATE TRIGGER doctor_access_sessions_no_truncate
BEFORE TRUNCATE ON doctor_access_sessions
FOR EACH STATEMENT EXECUTE FUNCTION prevent_access_history_truncate();

CREATE FUNCTION prevent_document_truncate() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Original document records cannot be truncated';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER documents_no_truncate
BEFORE TRUNCATE ON documents
FOR EACH STATEMENT EXECUTE FUNCTION prevent_document_truncate();

CREATE FUNCTION prevent_audit_log_truncate() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Audit log records are append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_logs_no_truncate
BEFORE TRUNCATE ON audit_logs
FOR EACH STATEMENT EXECUTE FUNCTION prevent_audit_log_truncate();