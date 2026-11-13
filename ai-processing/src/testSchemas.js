
import { MedicalRecordSchema } from "./schemas/medicalRecordSchema.js";

// Test 1: Valid medical record
const validRecord = {
  documentType: "lab_report",
  documentDate: "2026-10-15",

  patient: {
    name: null,
    age: null,
    gender: null,
  },

  clinicalEvents: [
    {
      eventType: "lab_result",
      name: "Hemoglobin",
      value: "13.5",
      unit: "g/dL",
      date: "2026-10-15",
      status: null,
      details: null,
      source: {
        page: 1,
        text: "Hemoglobin 13.5 g/dL",
      },
      confidence: 0.98,
    },
  ],

  extractionWarnings: [],
};

// Test 2: Invalid medical record
const invalidRecord = {
  ...validRecord,
  clinicalEvents: [
    {
      ...validRecord.clinicalEvents[0],
      confidence: 1.5, // Invalid: confidence cannot exceed 1
    },
  ],
};

// Run validation
const validResult = MedicalRecordSchema.safeParse(validRecord);
const invalidResult = MedicalRecordSchema.safeParse(invalidRecord);

console.log("\nTEST 1: Valid record");

if (validResult.success) {
  console.log("PASSED: Record accepted!");
} else {
  console.log("FAILED:", validResult.error.issues);
}

console.log("\nTEST 2: Invalid record");

if (!invalidResult.success) {
  console.log("PASSED: Invalid record rejected!");
  console.log("Reason:", invalidResult.error.issues);
} else {
  console.log("FAILED: Invalid record was accepted!");
}
