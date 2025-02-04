import express, { Request, Response } from "express";
import dotenv from "dotenv";
import router from "./routes/route.js";

dotenv.config();

const app = express();
app.use(express.json());
app.use('/api', router);

app.get("/", (req: Request, res: Response) => {
  res.send("Hello, Express + TypeScript!");
});

const PORT = process.env.PORT || 5005;
app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});
