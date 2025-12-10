import { Worker } from "bullmq";
import dotenv from "dotenv";
dotenv.config();

const worker = new Worker(
  "transcode",
  async (job) => {
    const { videoId } = job.data;
    console.log("Processing video:", videoId);

    // For now just log and mark in DB later (Step 10)
  },
  {
    connection: {
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT)
    },
  }
);

console.log("Worker started...");
