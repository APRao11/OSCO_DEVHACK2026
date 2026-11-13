-- The document's own date (visit date, report date, sample collection date),
-- extracted with a verified quote. Findings without their own date fall back
-- to it (MVP document 8.6: "fallback: document date, marked as such").
-- An ambiguous date such as 04/05/2021 is never guessed: document_date stays
-- NULL and both readings are kept in document_date_alternatives.
ALTER TABLE documents
  ADD COLUMN document_date date,
  ADD COLUMN document_date_text text,
  ADD COLUMN document_date_precision text CHECK (document_date_precision IN ('day', 'month', 'year')),
  ADD COLUMN document_date_alternatives jsonb;
