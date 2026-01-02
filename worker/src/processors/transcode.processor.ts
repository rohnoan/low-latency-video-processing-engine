import "dotenv/config";
import { Job, Queue } from "bullmq";
import { prisma } from "../lib/prisma";
import { downloadFromS3, uploadToS3 } from "../services/s3.service";
import {
  transcode480p,
  transcode720p,
  generateThumbnail,
  getVideoHeight,
} from "../services/ffmpeg.service";
import fs from "fs";
import os from "os";
import path from "path";

/**
 * Temp directory
 */
const TMP = os.tmpdir();

/**
 * Redis connection
 */
const connection = {
  host: process.env.REDIS_HOST || "redis",
  port: Number(process.env.REDIS_PORT) || 6379,
};

/**
 * Dead Letter Queue
 */
const transcodeDLQ = new Queue("transcodeDLQ", { connection });

const bucket = process.env.AWS_BUCKET!;
if (!bucket) throw new Error("AWS_BUCKET env missing");

export async function processTranscodeJob(job: Job) {
  const { videoId } = job.data;

  const inputFile = path.join(TMP, `${videoId}.mp4`);
  const output480 = path.join(TMP, `${videoId}_480p.mp4`);
  const output720 = path.join(TMP, `${videoId}_720p.mp4`);
  const thumbPath = path.join(TMP, `${videoId}_thumb.jpg`);

  const output480Key = `videos/${videoId}/480p.mp4`;
  const output720Key = `videos/${videoId}/720p.mp4`;
  const thumbKey = `videos/${videoId}/thumb.jpg`;

  try {
    console.log("[worker] job start", { videoId });

    // 1️⃣ Fetch video
    const video = await prisma.video.findUnique({
      where: { id: videoId },
    });
    if (!video) throw new Error("Video not found");

    // 2️⃣ Mark processing
    await prisma.video.update({
      where: { id: videoId },
      data: {
        status: "processing",
        processingStartedAt: new Date(),
      },
    });

    // 3️⃣ Download raw
    console.log("[worker] downloading raw");
    await downloadFromS3(bucket, video.rawKey, inputFile);

    // 4️⃣ Thumbnail
    console.log("[worker] generating thumbnail");
    await generateThumbnail(inputFile, thumbPath);
    await uploadToS3(bucket, thumbKey, thumbPath);

    await prisma.video.update({
      where: { id: videoId },
      data: {
        thumbKey,
        thumbGeneratedAt: new Date(),
      },
    });

    // 5️⃣ Transcode 480p (always)
    console.log("[worker] transcoding 480p");
    await transcode480p(inputFile, output480);
    await uploadToS3(bucket, output480Key, output480);

    // 6️⃣ Decide variants
    const height = await getVideoHeight(inputFile);
    console.log("[worker] source height:", height);

    const variants: { resolution: string; key: string }[] = [
      { resolution: "480p", key: output480Key },
    ];

    if (height >= 720) {
      console.log("[worker] transcoding 720p");
      await transcode720p(inputFile, output720);
      await uploadToS3(bucket, output720Key, output720);
      variants.push({ resolution: "720p", key: output720Key });
    } else {
      console.log("[worker] skipping 720p");
    }

    // 7️⃣ Final DB update (TRUTH ONLY)
    await prisma.video.update({
      where: { id: videoId },
      data: {
        status: "processed",
        variants,
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

    const finalAttempt =
      job.attemptsMade + 1 >= (job.opts.attempts ?? 1);

    if (finalAttempt) {
      await transcodeDLQ.add("dead-video", {
        videoId,
        error: err.message,
        attempts: job.attemptsMade + 1,
      });

      await prisma.video.update({
        where: { id: videoId },
        data: {
          status: "failed",
          failCount: { increment: 1 },
          lastError: err.message,
        },
      });
    }

    throw err;
  } finally {
    safeUnlink(inputFile);
    safeUnlink(output480);
    safeUnlink(output720);
    safeUnlink(thumbPath);
  }
}

/**
 * Cleanup helper
 */
function safeUnlink(filePath: string) {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {}
}
