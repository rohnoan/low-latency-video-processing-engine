import { Queue } from "bullmq";

export const transcodeQueue = new Queue("transcode", {
  connection: {
    host: process.env.REDIS_HOST!,
    port: Number(process.env.REDIS_PORT!),
  },
});
