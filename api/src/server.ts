
import dotenv from "dotenv"; 
dotenv.config();
import express from "express";
import uploadRouter from "./routes/upload"; 
import path from "path"; 

const app = express();
app.use(express.json());

app.use("/api", uploadRouter);

app.listen(3000, () => {
  console.log("api running on port 3000");
});
