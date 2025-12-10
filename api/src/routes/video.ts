import express from "express";
import { prisma } from "../lib/prisma";
import { transcodeQueue } from "../lib/queue";
const router = express.Router();

router.post("/upload/complete", async (req, res) => {
  const { videoId } = req.body;

  if (!videoId) return res.status(400).json({ error: "videoId required" });
 
  await prisma.video.update({
    where: { id: videoId },
    data: { status: "queued" }
  });

    await transcodeQueue.add("transcode", { videoId });

  return res.json({ ok: true });
});

export default router;
