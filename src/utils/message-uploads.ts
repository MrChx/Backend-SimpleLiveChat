import multer from "multer";
import path from "path";
import { fileURLToPath } from 'url';
import fs from "fs-extra";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const messageStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../../src/pic');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = `msg-${Date.now()}-${Math.round(Math.random() * 1E9)}`;
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

export const messageUpload = multer({
    storage: messageStorage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error("Format file tidak didukung! Hanya gambar, PDF, Word, dan Excel yang diizinkan."));
    }
});

export const deleteMessageFile = async (filePath: string) => {
    try {
        if (!filePath) return;
        
        const fileName = path.basename(filePath);
        if (fileName.startsWith('msg-')) {
            const fullPath = path.join(__dirname, '../../src/pic', fileName);
            if (await fs.pathExists(fullPath)) {
                await fs.unlink(fullPath);
            }
        }
    } catch (error) {
        console.error('Error deleting message file:', error);
    }
};