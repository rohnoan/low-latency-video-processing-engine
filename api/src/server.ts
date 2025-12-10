
import dotenv from "dotenv"; 
dotenv.config();
import express from "express";
import uploadRouter from "./routes/upload"; 
import videoRouter from "./routes/video";

const app = express();
app.use(express.json());

app.use("/api", uploadRouter);
app.use("/api", videoRouter);

app.listen(3000, () => {
  console.log("api running on port 3000");
});
