import express from "express";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuid } from "uuid";
import { prisma } from "../lib/prisma";

const router = express.Router();

//creates s3 connection with client to the bucket
const s3 = new S3Client({
  region: process.env.AWS_REGION as string,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string
  }
});

router.post("/upload/request", async (req, res) => {
  try {
    const { title, userId } = req.body;

    if (!title || !userId) {
      return res.status(400).json({ error: "title and userId required" });
    }

    const videoId = uuid();

    //unique s3 file path based on uuid 
    const key = `videos/${videoId}/raw.mp4`;

    // 1. INSERT INTO DB
    const video = await prisma.video.create({
      data: {
        id:videoId,
        title,
        rawKey: key,
        status: "uploaded",
        userId
      }
    });

    // upload instructution for the path
    const command = new PutObjectCommand({
      Bucket: process.env.AWS_BUCKET,
      Key: key,
      ContentType: "video/mp4"
    });

    //gets the url
    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 600 });

    return res.json({
      videoId,
      uploadUrl,
      key, 
    });
  } catch (err) {
    console.error("presign error", err);
    res.status(500).json({ error: "something went wrong" });
  }
});

export default router;
