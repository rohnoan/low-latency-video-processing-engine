import { Response } from "express";
import { prisma } from "../lib/prisma";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import { AuthRequest } from "../middleware/auth.middleware";

const s3 = new S3Client({ region: process.env.AWS_REGION! });

export const requestUpload = async (req: AuthRequest, res: Response) => {
  const { title } = req.body;

  if (!title) {
    return res.status(400).json({ error: "title required" });
  }

  // 🔐 Auth guarantee
  if (!req.user) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const videoId = randomUUID();
  const key = `videos/${videoId}/raw.mp4`;

  await prisma.video.create({
    data: {
      id: videoId,
      title,
      rawKey: key,
      status: "uploaded",
      userId: req.user.id,
    },
  });

  const command = new PutObjectCommand({
    Bucket: process.env.AWS_BUCKET!,
    Key: key,
    ContentType: "video/mp4",
  });

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 600 });

  return res.json({ videoId, uploadUrl, key });
};
