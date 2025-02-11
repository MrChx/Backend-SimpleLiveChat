import express, { Request, Response } from "express";
import dotenv from "dotenv";
import router from "./routes/route.js";
import path from "path";
import cookieParser from "cookie-parser";
import multer from "multer";
import { app, server } from "./utils/socket.js";

dotenv.config();

// const app = express();
app.use(express.json());
app.use('/api', router);
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, "/src/pic"));
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

export const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const fileTypes = /jpeg|jpg|png|gif/;
        const extname = fileTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = fileTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            return cb(new Error("Hanya format gambar (jpeg, jpg, png, gif) yang diizinkan!"));
        }
    }
});

const PORT = process.env.PORT || 5005;
const __dirname = path.resolve();

if (process.env.NODE_ENV !== "development") {
	app.use(express.static(path.join(__dirname, "/frontend/dist")));
	app.get("*", (req, res) => {
		res.sendFile(path.join(__dirname, "frontend", "dist", "index.html"));
	});
}
server.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});
