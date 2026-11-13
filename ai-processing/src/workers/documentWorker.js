
import { Worker } from "bullmq";
import connection from "../config/redis.js";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { extractPdfText } from "../services/pdfExtractor.js";

const worker = new Worker(
  "document-processing",
  async (job) => {
    console.log("\nJob received by worker!");

    const { documentId, patientId, filePath } = job.data;

    console.log("Document ID:", documentId);
    console.log("Patient ID:", patientId);
    console.log("File path:", filePath);

    // Get the full PDF path
    const pdfPath = path.resolve(filePath);

    // Extract text from the PDF
    console.log("\nExtracting PDF text...");

    const extractedText = await extractPdfText(pdfPath);

    if (!extractedText.trim()) {
      throw new Error("No text could be extracted from the PDF");
    }

    // Create output folder if it does not exist
    await mkdir("output", { recursive: true });

    // Save extracted text
    const outputPath = path.resolve(
      "output",
      `${documentId}.txt`
    );

    await writeFile(outputPath, extractedText, "utf8");

    console.log("Text extraction successful!");
    console.log("Extracted characters:", extractedText.length);
    console.log("Saved to:", outputPath);

    return {
      success: true,
      documentId,
      patientId,
      outputPath,
      extractedCharacters: extractedText.length,
    };
  },
  { connection,
     concurrency: 3,
   }
);

worker.on("completed", (job, result) => {
  console.log("\nJob completed:", job.id);
  console.log("Result:", result);
});

worker.on("failed", (job, error) => {
  console.error("\nJob failed:", error.message);
});

console.log("Document worker is running and waiting for jobs...");
