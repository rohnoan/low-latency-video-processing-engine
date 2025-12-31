
import dotenv from "dotenv"; 
dotenv.config();
import express from "express";
import uploadRouter from "./routes/upload";  
import videosRouter from "./routes/videos.routes";
import { startSqsConsumer } from "./lib/sqsConsumer";

const app = express();
app.use(express.json());

app.use("/api", uploadRouter); 
app.use("/videos", videosRouter);


startSqsConsumer();

app.listen(3000, () => {
  console.log("api running on port 3000");
});
