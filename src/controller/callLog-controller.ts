import { Request, Response } from "express";
import prisma from "../db/prisma.js";
import { getReceiverSocketId, io } from "../utils/socket.js";

export const createCallLog = async (req: Request, res: Response) => {
    try {
        const { callType, duration} = req.body;
        const { id: receiverId } = req.params;

        if (!req.user) {
            return res.status(401).json({ 
                code: 401,
                status: "error",
                message: "Unauthorized",
            });
        }

        if (!callType || !duration) {
            return res.status(400).json({
                code: 400,
                status: "error",
                message: "tipe panggilan dan durasi harus diisi",
            });
        }
        
        if (!["voice", "video"].includes(callType)) {
            return res.status(400).json({
                code: 400,
                status: "error",
                message: "tipe panggilan harus voice atau video",
            });
        }

        if (!receiverId) {
            return res.status(400).json({
                code: 400,
                status: "error",
                message: "id penerima harus diisi",
            });
        }

        const callerId = req.user.id;

        const receiverExists = await prisma.user.findUnique({
            where: { id: receiverId },
        });

        if (!receiverExists) {
            return res.status(404).json({
                code: 404,
                status: "error",
                message: "User penerima tidak ditemukan"
            });
        }

        // Check if user is blocked
        const isBlocked = await prisma.blockedUser.findFirst({
            where: {
                OR: [
                    {
                        blockerId: receiverId,
                        blockedId: callerId
                    },
                    {
                        blockerId: callerId,
                        blockedId: receiverId
                    }
                ]
            }
        });

        if (isBlocked) {
            return res.status(403).json({
                code: 403,
                status: "error",
                message: "Tidak dapat melakukan panggilan karena user diblokir"
            });
        }

        const newCallLog = await prisma.callLog.create({
            data: {
                callerId,
                receiverId,
                callType,
                duration
            },
            include: {
                caller: {
                    select: {
                        id: true,
                        username: true,
                        fullname: true,
                        profilePic: true
                    }
                },
                receiver: {
                    select: {
                        id: true,
                        username: true,
                        fullname: true,
                        profilePic: true
                    }
                }
            }
        });

        // Notify receiver about the call via socket
        const receiverSocketId = getReceiverSocketId(receiverId);
        if (receiverSocketId) {
            io.to(receiverSocketId).emit("newCallLog", newCallLog);
        }

        res.status(201).json({
            code: 201,
            status: "success",
            message: "Log panggilan berhasil dibuat",
            data: newCallLog
        });
    } catch (error: any) {
        console.error("Error in createCallLog:", error.message);
        res.status(500).json({
            code: 500,
            status: "error",
            message: "Internal Server Error",
            error: error.message
        });
    }
};

export const getCallHistory = async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                code: 401,
                status: "error",
                message: "Unauthorized - User not found"
            });
        }

        const userId = req.user.id;

        const callLogs = await prisma.callLog.findMany({
            where: {
                OR: [
                    { callerId: userId },
                    { receiverId: userId }
                ]
            },
            include: {
                caller: {
                    select: {
                        id: true,
                        username: true,
                        fullname: true,
                        profilePic: true,
                        isOnline: true,
                        lastSeen: true
                    }
                },
                receiver: {
                    select: {
                        id: true,
                        username: true,
                        fullname: true,
                        profilePic: true,
                        isOnline: true,
                        lastSeen: true
                    }
                }
            },
            orderBy: {
                createdAt: "desc"
            }
        });

        // Format the response to show the other party in each call
        const formattedCallHistory = callLogs.map(call => {
            const isOutgoing = call.callerId === userId;
            const otherParty = isOutgoing ? call.receiver : call.caller;
            
            return {
                id: call.id,
                otherParty,
                callType: call.callType,
                duration: call.duration,
                isOutgoing,
                timestamp: call.createdAt
            };
        });

        res.status(200).json({
            code: 200,
            status: "success",
            message: "Berhasil mendapatkan riwayat panggilan",
            data: formattedCallHistory
        });
    } catch (error: any) {
        console.error("Error in getCallHistory: ", error.message);
        res.status(500).json({
            code: 500,
            status: "error",
            message: "Internal server error",
            error: error.message
        });
    }
};

export const getCallHistoryWithUser = async (req: Request, res: Response) => {
    try {
        const { id: otherUserId } = req.params;

        if (!req.user) {
            return res.status(401).json({
                code: 401,
                status: "error",
                message: "Unauthorized - User not found"
            });
        }

        if (!otherUserId) {
            return res.status(400).json({
                code: 400,
                status: "error",
                message: "ID user tidak valid"
            });
        }

        const userId = req.user.id;

        const userExists = await prisma.user.findUnique({
            where: { id: otherUserId },
        });

        if (!userExists) {
            return res.status(404).json({
                code: 404,
                status: "error",
                message: "User tidak ditemukan"
            });
        }

        // Get calls between the two users
        const callLogs = await prisma.callLog.findMany({
            where: {
                OR: [
                    {
                        callerId: userId,
                        receiverId: otherUserId
                    },
                    {
                        callerId: otherUserId,
                        receiverId: userId
                    }
                ]
            },
            include: {
                caller: {
                    select: {
                        id: true,
                        username: true,
                        fullname: true,
                        profilePic: true
                    }
                },
                receiver: {
                    select: {
                        id: true,
                        username: true,
                        fullname: true,
                        profilePic: true
                    }
                }
            },
            orderBy: {
                createdAt: "desc"
            }
        });

        // Format the response
        const formattedCallHistory = callLogs.map(call => {
            const isOutgoing = call.callerId === userId;
            
            return {
                id: call.id,
                callType: call.callType,
                duration: call.duration,
                isOutgoing,
                timestamp: call.createdAt
            };
        });

        res.status(200).json({
            code: 200,
            status: "success",
            message: "Berhasil mendapatkan riwayat panggilan dengan user",
            data: formattedCallHistory
        });
    } catch (error: any) {
        console.error("Error in getCallHistoryWithUser: ", error.message);
        res.status(500).json({
            code: 500,
            status: "error",
            message: "Internal server error",
            error: error.message
        });
    }
};