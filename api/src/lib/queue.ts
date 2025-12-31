import { Queue } from "bullmq";

const connection = {
  host: process.env.REDIS_HOST!,
  port: Number(process.env.REDIS_PORT!),
};

export const transcodeQueue = new Queue("transcode", {
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

export const transcodeDLQ = new Queue("transcodeDLQ", {
  connection,
});
