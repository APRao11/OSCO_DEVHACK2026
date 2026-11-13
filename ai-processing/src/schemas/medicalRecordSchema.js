
import { z } from "zod";

// Allowed types of medical documents
const DocumentTypeSchema = z.enum([
  "lab_report",
  "prescription",
  "discharge_summary",
  "clinical_note",
  "imaging_report",
  "other",
]);

// Allowed types of medical events
const EventTypeSchema = z.enum([
  "lab_result",
  "diagnosis",
  "medication",
  "procedure",
  "allergy",
  "vital",
]);

// Information about where an extracted fact came from
const SourceSchema = z.object({
  page: z.number().int().positive(),
  text: z.string().min(1),
}).strict();

// One extracted medical event
const ClinicalEventSchema = z.object({
  eventType: EventTypeSchema,
  name: z.string().min(1),
  value: z.string().nullable(),
  unit: z.string().nullable(),
  date: z.iso.date().nullable(),
  status: z.string().nullable(),
  details: z.string().nullable(),
  source: SourceSchema,
  confidence: z.number().min(0).max(1),
}).strict();

// Complete medical document extraction
export const MedicalRecordSchema = z.object({
  documentType: DocumentTypeSchema,
  documentDate: z.iso.date().nullable(),

  patient: z.object({
    name: z.string().nullable(),
    age: z.number().int().min(0).max(130).nullable(),
    gender: z.string().nullable(),
  }).strict(),

  clinicalEvents: z.array(ClinicalEventSchema),

  extractionWarnings: z.array(z.string()),
}).strict();
