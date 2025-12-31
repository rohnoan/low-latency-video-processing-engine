import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
} from "@aws-sdk/client-sqs";
import { prisma } from "./prisma";
import { transcodeQueue } from "./queue";

// my api polls sqs then adds those jobs to bullmq and deletes in sqs unless error

const sqs = new SQSClient({ region: process.env.AWS_REGION! });
const QUEUE_URL = process.env.SQS_QUEUE_URL!;

export async function startSqsConsumer() {
  console.log("SQS consumer started");

  while (true) {
    const res = await sqs.send(
      new ReceiveMessageCommand({
        QueueUrl: QUEUE_URL,
        MaxNumberOfMessages: 5,
        WaitTimeSeconds: 20,
      })
    );

    if (!res.Messages) continue;

    for (const msg of res.Messages) {
      try {
        if (!msg.Body) continue;

        const body = JSON.parse(msg.Body);

        // Ignore TestEvent
        const record = body.Records?.[0];
        const key: string | undefined = record?.s3?.object?.key;
        if (!key || !key.endsWith("/raw.mp4")) {
          await deleteMsg(msg.ReceiptHandle!);
          continue;
        }

        const videoId = key.split("/")[1];
        if (!videoId) {
          await deleteMsg(msg.ReceiptHandle!);
          continue;
        }

        // Idempotency check
        const video = await prisma.video.findUnique({
          where: { id: videoId },
          select: { status: true },
        });

        if (!video || video.status !== "uploaded") {
          await deleteMsg(msg.ReceiptHandle!);
          continue;
        }

        // Update status
        await prisma.video.update({
          where: { id: videoId },
          data: { status: "queued" },
        });

        // Enqueue job
        await transcodeQueue.add("transcode", { videoId });

        // Delete SQS message
        await deleteMsg(msg.ReceiptHandle!);
      } catch (err) {
        console.error("SQS processing failed:", err);
        // DO NOT delete → SQS retry + DLQ handles it
      }
    }
  }
}

async function deleteMsg(receiptHandle: string) {
  await sqs.send(
    new DeleteMessageCommand({
      QueueUrl: QUEUE_URL,
      ReceiptHandle: receiptHandle,
    })
  );
}
