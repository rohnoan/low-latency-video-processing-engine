import { Router } from "express";
import { playVideo } from "../controllers/playbackController";

const router = Router();

router.get("/:id/play", playVideo);

export default router;
