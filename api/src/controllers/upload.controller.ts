import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";

const s3 = new S3Client({ region: process.env.AWS_REGION! });

export const requestUpload = async (req: Request, res: Response) => {
  const { title, userId } = req.body;

  if (!title || !userId) {
    return res.status(400).json({ error: "title and userId required" });
  }

  const videoId = randomUUID();
  const key = `videos/${videoId}/raw.mp4`;

  await prisma.video.create({
    data: {
      id: videoId,
      title,
      userId,
      rawKey: key,
      status: "uploaded",
    },
  });

  const command = new PutObjectCommand({
    Bucket: process.env.AWS_BUCKET!,
    Key: key,
    ContentType: "video/mp4",
  });

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 600 });

  res.json({ videoId, uploadUrl, key });
};
