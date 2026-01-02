import { Router } from "express";
import {
  listVideos,
  retryVideo,
  playVideo,
  getThumbnail,
} from "../controllers/video.controller";
import { auth } from "../middleware/auth.middleware";


const router = Router();

router.get("/", auth(),listVideos);
router.post("/:id/retry",auth(["admin"]), retryVideo);
router.get("/:id/play",auth(), playVideo);
router.get("/:id/thumbnail",auth(), getThumbnail);

export default router;
