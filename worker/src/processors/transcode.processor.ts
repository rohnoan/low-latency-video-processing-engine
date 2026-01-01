import "dotenv/config";
import { Job, Queue } from "bullmq";
import { prisma } from "../lib/prisma";
import { downloadFromS3, uploadToS3 } from "../services/s3.service";
import { transcode480p, generateThumbnail } from "../services/ffmpeg.service";
import fs from "fs";
import os from "os";
import path from "path";

/**
 * Temp directory (safe on Windows/Linux/Mac)
 */
const TMP = os.tmpdir();

/**
 * Redis connection (same as server.ts)
 */
const connection = {
  host: process.env.REDIS_HOST || "localhost",
  port: Number(process.env.REDIS_PORT) || 6379,
};

/**
 * BullMQ DLQ for FINAL execution failures
 */
const transcodeDLQ = new Queue("transcodeDLQ", { connection });

const bucket = process.env.AWS_BUCKET!;
if (!bucket) {
  throw new Error("AWS_BUCKET env missing");
}

/**
 * Main BullMQ processor
 */
export async function processTranscodeJob(job: Job) {
  const { videoId } = job.data;

  // Local file paths
  const inputFile = path.join(TMP, `${videoId}.mp4`);
  const output480 = path.join(TMP, `${videoId}_480p.mp4`);
  const thumbPath = path.join(TMP, `${videoId}_thumb.jpg`);

  // S3 keys
  const outputKey = `videos/${videoId}/480p.mp4`;
  const thumbKey = `videos/${videoId}/thumb.jpg`;

  try {
    console.log("[worker] job start", { videoId });

    // 1️⃣ Fetch video row
    const video = await prisma.video.findUnique({
      where: { id: videoId },
    });

    if (!video) {
      throw new Error("Video not found in DB");
    }

    // 2️⃣ Mark processing started
    await prisma.video.update({
      where: { id: videoId },
      data: {
        status: "processing",
        processingStartedAt: new Date(),
      },
    });

    // 3️⃣ Download raw video
    console.log("[worker] downloading raw video");
    await downloadFromS3(bucket, video.rawKey, inputFile);

    // 4️⃣ Generate thumbnail @ 00:00:02
    console.log("[worker] generating thumbnail");
    await generateThumbnail(inputFile, thumbPath);

    console.log("[worker] uploading thumbnail");
    await uploadToS3(bucket, thumbKey, thumbPath);

    await prisma.video.update({
      where: { id: videoId },
      data: {
        thumbKey,
        thumbGeneratedAt: new Date(),
      },
    });

    // 5️⃣ Transcode 480p
    console.log("[worker] transcoding 480p");
    await transcode480p(inputFile, output480);

    console.log("[worker] uploading 480p");
    await uploadToS3(bucket, outputKey, output480);

    // 6️⃣ Final DB update
    await prisma.video.update({
      where: { id: videoId },
      data: {
        status: "processed",
        variants: [{ resolution: "480p", key: outputKey }],
        transcodedAt: new Date(),
      },
    });

    console.log("[worker] job finished", { videoId });

  } catch (err: any) {
    console.error("[worker] job failed", {
      videoId,
      error: err.message,
      attempt: job.attemptsMade + 1,
    });

    const isFinalAttempt =
      job.attemptsMade + 1 >= (job.opts.attempts ?? 1);

    if (isFinalAttempt) {
      // 🔥 Push to BullMQ DLQ
      await transcodeDLQ.add("dead-video", {
        videoId,
        error: err.message,
        attempts: job.attemptsMade + 1,
      });

      // 🔥 Persist failure
      await prisma.video.update({
        where: { id: videoId },
        data: {
          status: "failed",
          failCount: { increment: 1 },
          lastError: err.message,
        },
      });
    }

    // REQUIRED so BullMQ retries
    throw err;

  } finally {
    // 🧹 Cleanup temp files (best-effort)
    safeUnlink(inputFile);
    safeUnlink(output480);
    safeUnlink(thumbPath);
  }
}

/**
 * Safe file delete (never throws)
 */
function safeUnlink(filePath: string) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (_) {}
}
