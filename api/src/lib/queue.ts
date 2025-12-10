import { Queue } from "bullmq";

export const transcodeQueue = new Queue("transcode", {
  connection: {
    host: "localhost",
    port: 6379
  }
});
