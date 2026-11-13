CREATE TABLE patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text NOT NULL,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX patients_email_lower_unique ON patients (lower(email));

CREATE TABLE doctors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text NOT NULL,
  password_hash text NOT NULL,
  license_number text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX doctors_email_lower_unique ON doctors (lower(email));

CREATE TABLE documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  original_filename text NOT NULL,
  storage_key text NOT NULL UNIQUE,
  mime_type text NOT NULL,
  byte_size bigint NOT NULL CHECK (byte_size > 0),
  original_sha256 char(64) NOT NULL CHECK (original_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX documents_patient_created_idx ON documents (patient_id, created_at DESC);

CREATE FUNCTION protect_document_original() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Original document records cannot be deleted';
  END IF;
  IF OLD.patient_id IS DISTINCT FROM NEW.patient_id
    OR OLD.storage_key IS DISTINCT FROM NEW.storage_key
    OR OLD.byte_size IS DISTINCT FROM NEW.byte_size
    OR OLD.original_sha256 IS DISTINCT FROM NEW.original_sha256 THEN
    RAISE EXCEPTION 'Original document storage and integrity fields are immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER documents_original_immutable
BEFORE UPDATE OR DELETE ON documents
FOR EACH ROW EXECUTE FUNCTION protect_document_original();

CREATE TABLE doctor_access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  doctor_id uuid NOT NULL REFERENCES doctors(id) ON DELETE RESTRICT,
  purpose text NOT NULL CHECK (length(trim(purpose)) > 0),
  requested_access text NOT NULL CHECK (requested_access IN ('read', 'edit')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  approved_access text CHECK (approved_access IN ('read', 'edit')),
  decided_by_patient_id uuid REFERENCES patients(id) ON DELETE RESTRICT,
  requested_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  decided_at timestamptz,
  CHECK (expires_at > requested_at),
  CHECK (
    (status = 'pending' AND approved_access IS NULL AND decided_by_patient_id IS NULL AND decided_at IS NULL)
    OR (status = 'approved' AND approved_access IS NOT NULL AND decided_by_patient_id = patient_id AND decided_at IS NOT NULL)
    OR (status = 'denied' AND approved_access IS NULL AND decided_by_patient_id = patient_id AND decided_at IS NOT NULL)
  ),
  CHECK (approved_access IS NULL OR approved_access = 'read' OR requested_access = 'edit')
);

CREATE INDEX doctor_access_requests_patient_status_idx
  ON doctor_access_requests (patient_id, status, requested_at DESC);
CREATE INDEX doctor_access_requests_doctor_idx
  ON doctor_access_requests (doctor_id, requested_at DESC);

CREATE TABLE doctor_access_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL UNIQUE REFERENCES doctor_access_requests(id) ON DELETE RESTRICT,
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  doctor_id uuid NOT NULL REFERENCES doctors(id) ON DELETE RESTRICT,
  access_level text NOT NULL CHECK (access_level IN ('read', 'edit')),
  approved_by_patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  CHECK (expires_at > started_at)
);

CREATE INDEX doctor_access_sessions_active_idx
  ON doctor_access_sessions (patient_id, doctor_id, expires_at)
  WHERE revoked_at IS NULL;

CREATE FUNCTION require_patient_approved_access() RETURNS trigger AS $$
DECLARE
  access_request doctor_access_requests%ROWTYPE;
BEGIN
  SELECT * INTO access_request
  FROM doctor_access_requests
  WHERE id = NEW.request_id
  FOR KEY SHARE;

  IF NOT FOUND
    OR access_request.status <> 'approved'
    OR access_request.patient_id <> NEW.patient_id
    OR access_request.doctor_id <> NEW.doctor_id
    OR access_request.approved_access <> NEW.access_level
    OR access_request.decided_by_patient_id <> NEW.approved_by_patient_id
    OR access_request.decided_by_patient_id <> NEW.patient_id THEN
    RAISE EXCEPTION 'Access session requires matching explicit patient approval';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER doctor_access_session_requires_approval
BEFORE INSERT ON doctor_access_sessions
FOR EACH ROW EXECUTE FUNCTION require_patient_approved_access();

CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_type text NOT NULL CHECK (actor_type IN ('patient', 'doctor', 'system')),
  actor_id uuid,
  patient_id uuid REFERENCES patients(id) ON DELETE RESTRICT,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address inet,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_logs_patient_created_idx ON audit_logs (patient_id, created_at DESC);
CREATE INDEX audit_logs_actor_created_idx ON audit_logs (actor_type, actor_id, created_at DESC);

CREATE FUNCTION prevent_audit_log_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Audit log records are append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_logs_append_only
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();