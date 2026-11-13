
import { Queue } from "bullmq";
import connection from "../config/redis.js";

const documentQueue = new Queue("document-processing", {
  connection,
});

async function addMultipleJobs() {
  const documents = [
    {
      documentId: "DOC001",
      patientId: "PAT001",
      filePath: "samples/report.pdf",
    },
    {
      documentId: "DOC002",
      patientId: "PAT001",
      filePath: "samples/report2.pdf",
    },
    {
      documentId: "DOC003",
      patientId: "PAT001",
      filePath: "samples/report3.pdf",
    },
    {
      documentId: "DOC004",
      patientId: "PAT001",
      filePath: "samples/report4.pdf",
    },
    {
      documentId: "DOC005",
      patientId: "PAT001",
      filePath: "samples/report5.pdf",
    },
    {
      documentId: "DOC006",
      patientId: "PAT001",
      filePath: "samples/report6.pdf",
    },
  ];

  try {
    const jobs = await documentQueue.addBulk(
      documents.map((document) => ({
        name: "process-document",
        data: document,
      }))
    );

    console.log("All PDF jobs added successfully!");

    for (const job of jobs) {
      console.log(`Job ${job.id}: ${job.data.documentId}`);
    }
  } catch (error) {
    console.error("Failed to add jobs:", error);
  } finally {
    await documentQueue.close();
    await connection.quit();
  }
}

addMultipleJobs();
