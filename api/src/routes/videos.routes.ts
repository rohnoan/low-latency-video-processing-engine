import { Router } from "express";
import {
  listVideos,
  retryVideo,
  playVideo,
  getThumbnail,
} from "../controllers/video.controller";

const router = Router();

router.get("/", listVideos);
router.post("/:id/retry", retryVideo);
router.get("/:id/play", playVideo);
router.get("/:id/thumbnail", getThumbnail);

export default router;
