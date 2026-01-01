import "dotenv/config";
import { Worker } from "bullmq";
import { processTranscodeJob } from "./processors/transcode.processor";

const connection = {
  host: process.env.REDIS_HOST || "localhost",
  port: Number(process.env.REDIS_PORT) || 6379,
};

console.log("Starting transcode worker...");

new Worker(
  "transcode",
  processTranscodeJob,
  {
    connection,
  }
);

console.log("Transcode worker ready.");
