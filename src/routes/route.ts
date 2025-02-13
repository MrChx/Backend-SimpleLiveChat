import express, { Router } from "express";
import { getUser, login, logout, register, updatePassword, updateProfile, } from "../controller/auth-controller.js";
import protectRoute from "../middleware/auth-middleware.js";
import multer from "multer";
import { deleteMessage, editMessage, getMessages, getUsersForSidebar, sendMessage } from "../controller/message-controller.js";
import { messageUpload } from "../utils/message-uploads.js";

const router: Router = express.Router();
const upload = multer();

router.post("/register", register as express.RequestHandler, upload.none());
router.post("/login", login as express.RequestHandler, upload.none());
router.get("/get-user", protectRoute as express.RequestHandler, getUser as express.RequestHandler);
router.patch("/update-profile", protectRoute as express.RequestHandler, updateProfile as express.RequestHandler, upload.none());
router.patch("/update-password", protectRoute as express.RequestHandler, updatePassword as express.RequestHandler);
router.delete("/logout", protectRoute as express.RequestHandler, logout as express.RequestHandler);

router.post("/message/:id", protectRoute as express.RequestHandler, messageUpload.single('file'), sendMessage as express.RequestHandler);
router.get("/message/:id", protectRoute as express.RequestHandler, getMessages as express.RequestHandler);
router.get("/chat", protectRoute as express.RequestHandler, getUsersForSidebar as express.RequestHandler);
router.patch("/message/:messageId", protectRoute as express.RequestHandler, editMessage as express.RequestHandler);
router.delete("/message/:messageId", protectRoute as express.RequestHandler, deleteMessage as express.RequestHandler);

export default router;