import express, { Router } from "express";
import { getUser, login, logout, register, updatePassword, updateProfile, } from "../controller/auth-controller.js";
import protectRoute from "../middleware/auth-middleware.js";
import multer from "multer";
import { deleteMessage, editMessage, getMessages, getUsersForSidebar, sendMessage, updateConversationMessageStatus, updateMessageStatus } from "../controller/message-controller.js";
import { messageUpload } from "../utils/message-uploads.js";
import { acceptFriendRequest, getFriendList, getFriendRequests, getSendFriendRequest, rejectFriendRequest, sendFriendRequest } from "../controller/friends-controller.js";
import { blockUser, getBlockedUsers, unblockUser } from "../controller/block-controller.js";
import { addMember, createGroup, deletedGroup, getGroupList, getGroupMessage, leaveGroup, removeMember, updateGroupInfo } from "../controller/group-controller.js";
import { createCallLog, getCallHistory, getCallHistoryWithUser } from "../controller/callLog-controller.js";
import { addReaction, getReactions, removeReaction } from "../controller/emoji-controller.js";

const router: Router = express.Router();
const upload = multer();

router.post("/register", register as express.RequestHandler, upload.none());
router.post("/login", login as express.RequestHandler, upload.none());
router.get("/get-user", protectRoute, getUser as express.RequestHandler);
router.patch("/update-profile", protectRoute, updateProfile as express.RequestHandler, upload.none());
router.patch("/update-password", protectRoute, updatePassword as express.RequestHandler);
router.delete("/logout", protectRoute, logout as express.RequestHandler);

router.post("/message/:id", protectRoute as express.RequestHandler, messageUpload.single('file'), sendMessage as express.RequestHandler);
router.patch("/message/:messageId/status", protectRoute as express.RequestHandler, updateMessageStatus as express.RequestHandler);
router.patch("/conversation/:conversationId/status", protectRoute as express.RequestHandler, updateConversationMessageStatus as express.RequestHandler);
router.get("/message/:id", protectRoute, getMessages as express.RequestHandler);
router.get("/chat", protectRoute, getUsersForSidebar as express.RequestHandler);
router.patch("/message/:messageId", protectRoute, editMessage as express.RequestHandler);
router.delete("/message/:messageId", protectRoute, deleteMessage as express.RequestHandler);

router.post("/friends/request", protectRoute, sendFriendRequest as express.RequestHandler);
router.patch("/friends/request/accept", protectRoute, acceptFriendRequest as express.RequestHandler);
router.patch("/friends/request/reject", protectRoute, rejectFriendRequest as express.RequestHandler);
router.get("/friends/request", protectRoute, getFriendRequests as express.RequestHandler);
router.get("/friends/send/request", protectRoute, getSendFriendRequest as express.RequestHandler);
router.get("/friends/list", protectRoute, getFriendList as express.RequestHandler);

router.post("/block", protectRoute, blockUser);
router.post("/unblock", protectRoute, unblockUser);   
router.get("/list/block", protectRoute, getBlockedUsers);

router.post("/create/group", protectRoute, createGroup as express.RequestHandler);
router.post("/add/member/:groupId", protectRoute, addMember as express.RequestHandler);
router.post("/remove/member/:groupId", protectRoute, removeMember as express.RequestHandler);
router.delete("/leave/:groupId", protectRoute, leaveGroup as express.RequestHandler);
router.delete("delete/:groupId", protectRoute, deletedGroup as express.RequestHandler);
router.put("/group/:groupId", protectRoute, updateGroupInfo as express.RequestHandler);
router.get("/group/:groupId/messages", protectRoute, getGroupMessage as express.RequestHandler);
router.get("/groups", protectRoute, getGroupList as express.RequestHandler);

router.post("/calls/:receiverId", protectRoute, createCallLog as express.RequestHandler);
router.get("/calls/history", protectRoute, getCallHistory as express.RequestHandler);
router.get("/calls/history/:id", protectRoute, getCallHistoryWithUser as express.RequestHandler);

router.post("/reactions", protectRoute, addReaction as express.RequestHandler);
router.delete("/reactions/:id", protectRoute, removeReaction as express.RequestHandler);
router.get("/reactions/message/:messageId", protectRoute, getReactions as express.RequestHandler);


export default router;