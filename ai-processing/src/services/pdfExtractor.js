
import { readFile } from "node:fs/promises";
import { PDFParse } from "pdf-parse";

export async function extractPdfText(filePath) {
  const pdfBuffer = await readFile(filePath);

  const parser = new PDFParse({
    data: pdfBuffer,
  });

  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}
