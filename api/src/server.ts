
import dotenv from "dotenv"; 
dotenv.config();
import express from "express";
import uploadRouter from "./routes/upload.routes.";  
import videosRouter from "./routes/videos.routes";
import { startSqsConsumer } from "./lib/sqsConsumer";
import cors from "cors";

const app = express();

app.use(cors());          // 👈 ADD THIS
app.use(express.json()); 
app.use(express.json());

app.use("/api", uploadRouter); 
app.use("/videos", videosRouter);


startSqsConsumer();

app.listen(3000, () => {
  console.log("api running on port 3000");
});
