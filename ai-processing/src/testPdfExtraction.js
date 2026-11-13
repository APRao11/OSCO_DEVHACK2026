
import path from "node:path";
import { writeFile } from "node:fs/promises";
import { extractPdfText } from "./services/pdfExtractor.js";

async function testExtraction() {
  try {
    const pdfPath = path.resolve("samples/sample-report.pdf");

    const extractedText = await extractPdfText(pdfPath);

    console.log("PDF TEXT EXTRACTED SUCCESSFULLY!");
    console.log("\nExtracted content:\n");
    console.log(extractedText);

    const outputPath = path.resolve("output/DOC001.txt");

    await writeFile(outputPath, extractedText, "utf8");

    console.log("\nText saved to:", outputPath);
  } catch (error) {
    console.error("PDF extraction failed:", error);
  }
}

testExtraction();
