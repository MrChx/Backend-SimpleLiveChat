import express from "express";
import { getUser, login, logout, register, updateUser } from "../controller/auth-controller.js";
import protectRoute from "../middleware/auth-middleware.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.get("get-user", protectRoute, getUser);
router.patch("/update-user", protectRoute, updateUser);
router.delete("/logout", protectRoute, logout);

export default router;