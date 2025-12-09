import express from "express";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuid } from "uuid";

const router = express.Router();
console.log("AWS_REGION =", process.env.AWS_REGION);
console.log("AWS_ACCESS_KEY_ID =", process.env.AWS_ACCESS_KEY_ID);
console.log("AWS_SECRET_ACCESS_KEY =", process.env.AWS_SECRET_ACCESS_KEY ? "SET" : "MISSING");
console.log("AWS_BUCKET =", process.env.AWS_BUCKET);

const s3 = new S3Client({
  region: process.env.AWS_REGION as string,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string
  }
});




router.post("/upload/request", async (req, res) => {
  try {
    const { title } = req.body;
    if (!title) return res.status(400).json({ error: "title required" });

    const id = uuid();
    const key = `videos/${id}/raw.mp4`;

    const command = new PutObjectCommand({
      Bucket: process.env.AWS_BUCKET,
      Key: key,
      ContentType: "video/mp4"
    });

    // Generate presigned URL (valid for 10 minutes)
    const signedUrl = await getSignedUrl(s3, command, { expiresIn: 600 });

    return res.json({
      uploadUrl: signedUrl,
      key
    });
  } catch (err) {
    console.error("presign error", err);
    res.status(500).json({ error: "something went wrong" });
  }
});

export default router;
