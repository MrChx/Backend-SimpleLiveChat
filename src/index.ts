import express, { Request, Response } from "express";
import dotenv from "dotenv";
import router from "./routes/route.js";
import path from "path";
import cookieParser from "cookie-parser";

dotenv.config();

const app = express();
app.use(express.json());
app.use('/api', router);
app.use(cookieParser());

const PORT = process.env.PORT || 5005;
const __dirname = path.resolve();

if (process.env.NODE_ENV !== "development") {
	app.use(express.static(path.join(__dirname, "/frontend/dist")));
	app.get("*", (req, res) => {
		res.sendFile(path.join(__dirname, "frontend", "dist", "index.html"));
	});
}
app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});
