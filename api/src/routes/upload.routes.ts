import { Router } from "express";
import { requestUpload } from "../controllers/upload.controller";
import { auth } from "../middleware/auth.middleware";
const router = Router();

router.post("/upload/request",auth(), requestUpload);

export default router;
