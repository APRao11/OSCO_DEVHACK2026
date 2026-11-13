-- Document processing pipeline (MVP document sections 5.5, 7.2, 7.3, 8.3, 8.8).

-- Processing status per document: uploaded -> processing -> ready | failed.
-- protect_document_original() only guards the original-file columns, so these can change.
ALTER TABLE documents
  ADD COLUMN status text NOT NULL DEFAULT 'uploaded'
    CHECK (status IN ('uploaded', 'processing', 'ready', 'failed')),
  ADD COLUMN document_type text,
  ADD COLUMN page_count integer CHECK (page_count IS NULL OR page_count >= 0),
  ADD COLUMN extractor_version text,
  ADD COLUMN extraction_stats jsonb,
  ADD COLUMN processing_error text,
  ADD COLUMN processing_started_at timestamptz,
  ADD COLUMN processed_at timestamptz;

-- Safe repeats (section 8.3): one document per patient per file hash.
CREATE UNIQUE INDEX documents_patient_hash_unique ON documents (patient_id, original_sha256);

-- RAW layer: page text and OCR word boxes, never changed once written.
CREATE TABLE document_pages (
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE RESTRICT,
  page_number integer NOT NULL CHECK (page_number >= 1),
  text_source text NOT NULL CHECK (text_source IN ('text_layer', 'ocr')),
  page_text text NOT NULL,
  ocr_words jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (document_id, page_number)
);

-- CLEAN layer: verified findings (section 7.3).
CREATE TABLE claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  document_id uuid REFERENCES documents(id) ON DELETE RESTRICT,
  category text NOT NULL CHECK (category IN ('condition', 'medication', 'allergy', 'investigation', 'event')),
  name text NOT NULL,
  name_normalised text NOT NULL,
  subject text NOT NULL CHECK (subject IN ('patient', 'family', 'other')),
  subject_relation text,
  assertion text NOT NULL CHECK (assertion IN ('present', 'absent', 'possible', 'historical')),
  action text CHECK (action IN ('start', 'continue', 'change', 'stop', 'none')),
  dose text,
  frequency text,
  value text,
  unit text,
  ref_range text,
  date_text text,
  event_date date,
  date_precision text CHECK (date_precision IN ('day', 'month', 'year')),
  normalised jsonb NOT NULL DEFAULT '{}'::jsonb,
  quote text,
  page integer CHECK (page IS NULL OR page >= 1),
  quote_start integer CHECK (quote_start IS NULL OR quote_start >= 0),
  quote_end integer,
  match_type text CHECK (match_type IN ('exact', 'approximate')),
  ocr_word_boxes jsonb,
  source_type text NOT NULL CHECK (source_type IN ('ai_extracted', 'doctor_entered')),
  verification_status text NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified', 'doctor_verified', 'corrected', 'rejected')),
  supersedes_id uuid REFERENCES claims(id) ON DELETE RESTRICT,
  extractor_version text,
  -- Deterministic hash of the finding; with the unique index below it makes saves idempotent.
  fingerprint char(64),
  -- Set when the document is re-processed with a newer extractor_version (section 8.2).
  -- The row itself is kept; readers filter on retired_at IS NULL.
  retired_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (quote_end IS NULL OR quote_end > quote_start),
  CHECK (action IS NULL OR category = 'medication'),
  CHECK (source_type <> 'ai_extracted'
    OR (document_id IS NOT NULL AND quote IS NOT NULL AND page IS NOT NULL
        AND quote_start IS NOT NULL AND quote_end IS NOT NULL AND match_type IS NOT NULL
        AND extractor_version IS NOT NULL AND fingerprint IS NOT NULL))
);

CREATE UNIQUE INDEX claims_document_version_fingerprint_unique
  ON claims (document_id, extractor_version, fingerprint)
  WHERE fingerprint IS NOT NULL;
CREATE INDEX claims_patient_active_idx
  ON claims (patient_id, category, name_normalised)
  WHERE retired_at IS NULL;
CREATE INDEX claims_document_idx ON claims (document_id);

-- Rejected findings: kept with the raw LLM output and the reason, never shown (section 7.2.7).
CREATE TABLE rejected_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE RESTRICT,
  extractor_version text NOT NULL,
  reason text NOT NULL CHECK (reason IN ('schema_invalid', 'quote_length', 'quote_not_found', 'field_not_in_quote')),
  detail text,
  raw_output jsonb NOT NULL,
  fingerprint char(64) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, extractor_version, fingerprint)
);

CREATE INDEX rejected_claims_document_idx ON rejected_claims (document_id);
