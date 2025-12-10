import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { writeFile } from "fs/promises";
import { createWriteStream } from "fs";

const s3 = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
  }
});

export async function downloadFromS3(bucket: string, key: string, localPath: string) {
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  const response = await s3.send(command);

  return new Promise<void>((resolve, reject) => {
    const stream = response.Body as any;
    const fileStream = createWriteStream(localPath);

    stream.pipe(fileStream);

    fileStream.on("finish", () => resolve());
    fileStream.on("error", (err) => reject(err));
  });
}



import { readFile } from "fs/promises";

export async function uploadToS3(bucket: string, key: string, localPath: string) {
  const fileBuffer = await readFile(localPath);

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: fileBuffer,
    ContentType: "video/mp4"
  });

  await s3.send(command);
}

