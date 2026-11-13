
import { Queue } from "bullmq";
import connection from "./config/redis.js";

const queue = new Queue("document-processing", { connection });

async function checkQueue() {
  try {
    const counts = await queue.getJobCounts(
      "waiting",
      "active",
      "completed",
      "failed",
      "delayed"
    );

    console.log("\nQUEUE COUNTS:");
    console.log(counts);

    const jobs = await queue.getJobs(
      ["waiting", "active", "completed", "failed", "delayed"],
      0,
      100
    );

    console.log("\nJOB DETAILS:");

    for (const job of jobs) {
      const state = await job.getState();

      console.log({
        jobId: job.id,
        documentId: job.data.documentId,
        state,
        failedReason: job.failedReason || null,
      });
    }
  } catch (error) {
    console.error("Queue inspection failed:", error);
  } finally {
    await queue.close();
    await connection.quit();
  }
}

checkQueue();
