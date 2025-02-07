// route.ts
import express, { Router } from "express";
import { getUser, login, logout, register, updateUser } from "../controller/auth-controller.js";
import protectRoute from "../middleware/auth-middleware.js";
import multer from "multer";

const router: Router = express.Router();
const upload = multer();

router.post("/register", register as express.RequestHandler, upload.none());
router.post("/login", login as express.RequestHandler, upload.none());
router.get("/get-user", protectRoute as express.RequestHandler, getUser as express.RequestHandler);
router.patch("/update-user", protectRoute as express.RequestHandler, updateUser as express.RequestHandler,  upload.none());
router.delete("/logout", protectRoute as express.RequestHandler, logout as express.RequestHandler);

export default router;