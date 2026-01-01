import "dotenv/config";
import { Worker, Job, Queue } from "bullmq";
import { prisma } from "./prisma";
import { downloadFromS3, uploadToS3 } from "./s3";
import { transcode480p, generateThumbnail } from "./ffmpeg";
import fs from "fs";
import os from "os";
import path from "path";

const TMP = os.tmpdir(); // Windows-safe temp dir

const connection = {
  host: "localhost",
  port: 6379,
};

// BullMQ DLQ (execution failures)
const transcodeDLQ = new Queue("transcodeDLQ", { connection });

const bucket = process.env.AWS_BUCKET!;
console.log("Worker started...");

new Worker(
  "transcode",
  async (job: Job) => {
    const { videoId } = job.data;

    try {
      console.log("Processing video:", videoId);

      // 1. Fetch video row
      const video = await prisma.video.findUnique({
        where: { id: videoId },
      });

      if (!video) {
        throw new Error("Video not found in DB");
      }

      console.log("Raw key:", video.rawKey);

      // Local temp paths
      const inputFile = path.join(TMP, `${videoId}.mp4`);
      const output480 = path.join(TMP, `${videoId}_480p.mp4`);
      const thumbPath = path.join(TMP, `${videoId}_thumb.jpg`);

      const outputKey = `videos/${videoId}/480p.mp4`;
      const thumbKey = `videos/${videoId}/thumb.jpg`;

      // 2. Mark processing started
      await prisma.video.update({
        where: { id: videoId },
        data: {
          status: "processing",
          processingStartedAt: new Date(),
        },
      });

      // 3. Download raw video
      console.log("Downloading from S3...");
      await downloadFromS3(bucket, video.rawKey, inputFile);

      // 4. Generate thumbnail
      console.log("Generating thumbnail...");
      await generateThumbnail(inputFile, thumbPath);

      console.log("Uploading thumbnail...");
      await uploadToS3(bucket, thumbKey, thumbPath);

      await prisma.video.update({
        where: { id: videoId },
        data: {
          thumbKey,
          thumbGeneratedAt: new Date(),
        },
      });

      // 5. Transcode to 480p
      console.log("Running ffmpeg...");
      await transcode480p(inputFile, output480);

      console.log("Uploading 480p...");
      await uploadToS3(bucket, outputKey, output480);

      // 6. Final DB update
      await prisma.video.update({
        where: { id: videoId },
        data: {
          status: "processed",
          variants: [{ resolution: "480p", key: outputKey }],
          transcodedAt: new Date(),
        },
      });

      console.log("Finished processing:", videoId);

      // 7. Cleanup temp files
      fs.unlinkSync(inputFile);
      fs.unlinkSync(output480);
      fs.unlinkSync(thumbPath);

    } catch (err: any) {
      console.error("Worker error:", err);

      const isFinalAttempt =
        job.attemptsMade + 1 >= (job.opts.attempts ?? 1);

      if (isFinalAttempt) {
        // Push to BullMQ DLQ
        await transcodeDLQ.add("dead-video", {
          videoId,
          error: err.message,
          attempts: job.attemptsMade + 1,
        });

        // Persist failure in DB
        await prisma.video.update({
          where: { id: videoId },
          data: {
            status: "failed",
            failCount: { increment: 1 },
            lastError: err.message,
          },
        });
      }

      // REQUIRED: let BullMQ handle retries
      throw err;
    }
  },
  { connection }
);
