
import dotenv from "dotenv"; 
dotenv.config();
import express from "express";
import videosRouter from "./routes/videos.routes";
import { startSqsConsumer } from "./lib/sqsConsumer";
import uploadRouter from './routes/upload.routes'
import cors from "cors";
import authRouter from './routes/auth.routes'
const app = express();

app.use(cors());          // 👈 ADD THIS
app.use(express.json()); 

app.use("/api", uploadRouter); 
app.use("/videos", videosRouter);
app.use("/auth",authRouter);

startSqsConsumer();

app.listen(3000, () => {
  console.log("api running on port 3000");
});
