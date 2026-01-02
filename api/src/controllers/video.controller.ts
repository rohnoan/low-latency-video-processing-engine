import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { transcodeQueue } from "../lib/queue";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({
  region: process.env.AWS_REGION!,
});

// GET /videos
export const listVideos = async (_req: Request, res: Response) => {
  const videos = await prisma.video.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      status: true,
      thumbKey: true,
      variants: true,
      lastError: true,
      createdAt: true,
    },
  });

  res.json(videos);
};

// POST /videos/:id/retry
export const retryVideo = async (req: Request, res: Response) => {
  const { id } = req.params;

  const video = await prisma.video.findUnique({
    where: { id },
  });

  if (!video) {
    return res.status(404).json({ error: "video not found" });
  }

  if (video.status !== "failed") {
    return res.status(400).json({ error: "video is not retryable" });
  }

  await prisma.video.update({
    where: { id },
    data: {
      status: "processing",
      lastError: null,
    },
  });

  await transcodeQueue.add("retry-transcode", { videoId: id });

  res.json({ ok: true });
};

// GET /videos/:id/play
export const playVideo = async (req: Request, res: Response) => {
  const { id } = req.params;

  const video = await prisma.video.findUnique({
    where: { id },
    select: { status: true, variants: true },
  });

  if (!video) {
    return res.status(404).json({ error: "video not found" });
  }

  if (video.status !== "processed") {
    return res.status(409).json({ error: "video not ready" });
  }

  const variants = video.variants as Array<{ resolution: string; key: string }>;
  if (!variants || variants.length === 0) {
    return res.status(404).json({ error: "no variants available" });
  }

  const preferred = variants.find(v => v.resolution === "480p") ?? variants[0];

  const command = new GetObjectCommand({
    Bucket: process.env.AWS_BUCKET!,
    Key: preferred.key,
  });

  const playbackUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });

  res.json({
    playbackUrl,
    variant: preferred.resolution,
    expiresIn: 3600,
  });
};

// GET /videos/:id/thumbnail
export const getThumbnail = async (req: Request, res: Response) => {
  const { id } = req.params;

  const video = await prisma.video.findUnique({
    where: { id },
    select: { thumbKey: true },
  });

  if (!video || !video.thumbKey) {
    return res.status(404).json({ error: "thumbnail not found" });
  }

  const command = new GetObjectCommand({
    Bucket: process.env.AWS_BUCKET!,
    Key: video.thumbKey,
  });

  const url = await getSignedUrl(s3, command, { expiresIn: 3600 });

  res.json({ thumbnailUrl: url });
};
