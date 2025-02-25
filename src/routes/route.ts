import express, { Router } from "express";
import { getUser, login, logout, register, updatePassword, updateProfile, } from "../controller/auth-controller.js";
import protectRoute from "../middleware/auth-middleware.js";
import multer from "multer";
import { deleteMessage, editMessage, getMessages, getUsersForSidebar, sendMessage, updateConversationMessageStatus, updateMessageStatus } from "../controller/message-controller.js";
import { messageUpload } from "../utils/message-uploads.js";
import { acceptFriendRequest, getFriendList, getFriendRequests, getSendFriendRequest, rejectFriendRequest, sendFriendRequest } from "../controller/friends-controller.js";
import { blockUser, getBlockedUsers, unblockUser } from "../controller/block-controller.js";

const router: Router = express.Router();
const upload = multer();

router.post("/register", register as express.RequestHandler, upload.none());
router.post("/login", login as express.RequestHandler, upload.none());
router.get("/get-user", protectRoute as express.RequestHandler, getUser as express.RequestHandler);
router.patch("/update-profile", protectRoute as express.RequestHandler, updateProfile as express.RequestHandler, upload.none());
router.patch("/update-password", protectRoute as express.RequestHandler, updatePassword as express.RequestHandler);
router.delete("/logout", protectRoute as express.RequestHandler, logout as express.RequestHandler);

router.post("/message/:id", protectRoute as express.RequestHandler, messageUpload.single('file'), sendMessage as express.RequestHandler);
router.patch("/message/:messageId/status", protectRoute as express.RequestHandler, updateMessageStatus as express.RequestHandler);
router.patch("/conversation/:conversationId/status", protectRoute as express.RequestHandler, updateConversationMessageStatus as express.RequestHandler);
router.get("/message/:id", protectRoute as express.RequestHandler, getMessages as express.RequestHandler);
router.get("/chat", protectRoute as express.RequestHandler, getUsersForSidebar as express.RequestHandler);
router.patch("/message/:messageId", protectRoute as express.RequestHandler, editMessage as express.RequestHandler);
router.delete("/message/:messageId", protectRoute as express.RequestHandler, deleteMessage as express.RequestHandler);

router.post("/friends/request", protectRoute as express.RequestHandler, sendFriendRequest as express.RequestHandler);
router.patch("/friends/request/accept", protectRoute as express.RequestHandler, acceptFriendRequest as express.RequestHandler);
router.patch("/friends/request/reject", protectRoute as express.RequestHandler, rejectFriendRequest as express.RequestHandler);
router.get("/friends/request", protectRoute as express.RequestHandler, getFriendRequests as express.RequestHandler);
router.get("/friends/send/request", protectRoute as express.RequestHandler, getSendFriendRequest as express.RequestHandler);
router.get("/friends/list", protectRoute as express.RequestHandler, getFriendList as express.RequestHandler);

router.post("/block", protectRoute, blockUser);
router.post("/unblock", protectRoute, unblockUser);   
router.get("/list/block", protectRoute, getBlockedUsers);

export default router;