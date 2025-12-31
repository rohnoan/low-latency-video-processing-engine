import "dotenv/config";
import { Worker, Job } from "bullmq";
import { prisma } from "./prisma";
import { downloadFromS3, uploadToS3 } from "./s3";
import { transcode480p } from "./ffmpeg";
import fs from "fs";
import os from "os";
import path from "path";
import { Queue } from "bullmq";
const TMP = os.tmpdir(); // Windows safe

const connection = {
  host: "localhost",
  port: 6379,
};

const transcodeDLQ = new Queue("transcodeDLQ", { connection });

const bucket = process.env.AWS_BUCKET!;
console.log("Worker started...");

new Worker(
  "transcode",
  async (job: Job) => {
    try {
      const { videoId } = job.data;
      console.log("Processing video:", videoId);

      // 1. Fetch video from DB
      const video = await prisma.video.findUnique({ where: { id: videoId } });
      if (!video) {
        if (!video) {
          throw new Error("Video not found in DB");
        }

      }

      console.log("Raw key:", video.rawKey);

      // local temp paths
      const inputFile = path.join(TMP, `${videoId}.mp4`);
      const output480 = path.join(TMP, `${videoId}_480p.mp4`);

      // 2. Mark processing
      await prisma.video.update({
        where: { id: videoId },
        data: { status: "processing" }
      });

      // 3. Download original from S3
      console.log("Downloading from S3...");
      await downloadFromS3(bucket, video.rawKey, inputFile);

      // 4. Run ffmpeg
      console.log("Running ffmpeg...");
      await transcode480p(inputFile, output480);

      // 5. Upload transcoded video to S3
      console.log("Uploading output to S3...");
      const outputKey = `videos/${videoId}/480p.mp4`;

      await uploadToS3(bucket, outputKey, output480);

      // 6. Update DB with final result
      console.log("Updating DB...");
      await prisma.video.update({
        where: { id: videoId },
        data: {
          status: "processed",
          variants: [{ resolution: "480p", key: outputKey }]
        }
      });

      console.log("Finished processing:", videoId);

      // 7. Clean up
      fs.unlinkSync(inputFile);
      fs.unlinkSync(output480);
    } catch (err: any) {
  console.error("Worker error:", err);

  const isFinalAttempt =
    job.attemptsMade + 1 >= (job.opts.attempts ?? 1);

  if (isFinalAttempt) {
    await transcodeDLQ.add("dead-video", {
      videoId: job.data.videoId,
      error: err.message,
      attempts: job.attemptsMade + 1,
    });

    await prisma.video.update({
      where: { id: job.data.videoId },
      data: {
        status: "failed",
        failCount: { increment: 1 },
        lastError: err.message,
      },
    });
  }

  throw err; 
}

  },
  {
    connection: {
      host: "localhost",
      port: 6379
    }
  }
);
