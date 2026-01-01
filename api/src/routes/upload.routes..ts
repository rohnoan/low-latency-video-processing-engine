import { Router } from "express";
import { requestUpload } from "../controllers/upload.controller";

const router = Router();

router.post("/upload/request", requestUpload);

export default router;
