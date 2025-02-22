import { Request, Response } from "express";
import prisma from "../db/prisma.js";

export const sendFriendRequest = async (req: Request, res: Response) => {
    try {
        const { receiverId } = req.body;

        if (!req.user) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const existingRequest = await prisma.friendRequest.findFirst({
            where: {
                OR: [
                    {senderId: req.user.id, receiverId},
                    {senderId: receiverId, receiverId: req.user.id}
                ]
            }
        });

        if (existingRequest) {
            return res.status(400).json({
                code : 400,
                status: "error",
                message: "permintaan pertemanan sudah ada"
            });
        }

        const isBlocked = await prisma.blockedUser.findFirst({
            where: {
                OR: [
                    {blockerId: req.user.id, blockedId: receiverId},
                    {blockerId: receiverId, blockedId: req.user.id}
                ]
            }
        });

        if (isBlocked){
            return res.status(400).json({
                code : 400,
                status: "error",
                message: "Anda sedang diblokir oleh pengguna tersebut"
            });
        }

        const friendRequest = await prisma.friendRequest.create({
            data: {
                senderId: req.user.id,
                receiverId,
                status: "pending"
            }
        });

        res.status(201).json({
            code: 201,
            status: "success",
            message: "Permintaan pertemanan dikirim",
            data: friendRequest
        })
    } catch (error: any) {
        console.error("error in send friend request", error.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

export const acceptFriendRequest = async (req: Request, res: Response) => {
    try {
        const { requestId } = req.body;

        if (!req.user) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const friendRequest = await prisma.friendRequest.findFirst({
            where: {
                id: requestId
            }
        });

        if (!friendRequest) {
            return res.status(404).json({
                code: 404,
                status: "error",
                message: "Permintaan pertemanan tidak ditemukan"
            });
        }

        if (friendRequest.receiverId !== req.user.id) {
            return res.status(403).json({
                code: 403,
                status: "error",
                message: "Anda bukan penerima permintaan pertemanan ini"
            });
        }

        const updateRequest = await prisma.friendRequest.update({
            where: { id: requestId },
            data: { status: "accepted" }
        });

        await prisma.conversation.create({
            data: {
                participants: {
                    connect: [
                        { id: friendRequest.senderId },
                        { id: friendRequest.receiverId }
                    ]
                }
            }
        });

        res.status(200).json({
            code: 200,
            status: "success",
            message: "Permintaan pertemanan diterima",
            data: updateRequest
        });
    } catch (error: any) {
        console.error("Error in accept friend request", error.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

export const rejectFriendRequest = async (req: Request, res: Response) => {
    try{
        const { requestId } = req.body;

        if (!req.user) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const friendRequest = await prisma.friendRequest.findFirst({
            where: { id: requestId }
        });

        if (!friendRequest) {
            return res.status(404).json({
                code: 404,
                status: "error",
                message: "Permintaan pertemanan tidak ditemukan"
            });
        }

        if (friendRequest.receiverId !== req.user.id) {
            return res.status(403).json({
                code: 403,
                status: "error",
                message: "Tidak berwenang untuk menolak permintaan ini"
            });
        }

        const updatedRequest = await prisma.friendRequest.update({
            where: { id: requestId },
            data: { status: "rejected" }
        });

        return res.status(200).json({
            code: 200,
            status: "success",
            message: "Permintaan pertemanan ditolak",
            data: updatedRequest
        })
    } catch (error: any) {
        console.error("Error in reject friend request", error.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

export const getFriendRequests = async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                code: 401,
                status: "error",
                message: "Unauthorized",
            });
        }

        const incomingRequests = await prisma.friendRequest.findMany({
            where: {
                receiverId: req.user.id,
                status: "pending",
            },
            include: {
                sender: {
                    select: {
                        id: true,
                        username: true,
                        fullname: true,
                        profilePic: true,
                    },
                },
            },
        });

        // Perbaikan pengecekan array kosong
        if (incomingRequests.length === 0) {
            return res.status(404).json({
                code: 404,
                status: "error",
                message: "Tidak ada permintaan pertemanan",
            });
        }

        res.status(200).json({
            code: 200,
            status: "success",
            message: "Daftar permintaan pertemanan masuk",
            data: incomingRequests,
        });
    } catch (error: any) {
        console.error("Error in getFriendRequests:", error.message);
        res.status(500).json({
            code: 500,
            status: "error",
            message: "Terjadi kesalahan di server",
            error: error.message,
        });
    }
};

export const getSendFriendRequest = async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const sentReqquest = await prisma.friendRequest.findMany({
            where : {
                senderId: req.user.id,
                status: "pending"
            },
            include: {
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

        if (sentReqquest.length === 0) {
            return res.status(404).json({
                code: 404,
                status: "error",
                message: "Tidak ada permintaan pertemanan yang dikirim"
            });
        }

        res.status(200).json({
            code: 200,
            status: "success",
            message: "Daftar permintaan pertemanan yang dikirim",
            data: sentReqquest
        });
    } catch (error: any) {
        console.error("Error in get send friend request", error.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
}

export const getFriendList = async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const acceptedRequest = await prisma.friendRequest.findMany({
            where: {
                OR: [
                    { senderId: req.user.id },
                    { receiverId: req.user.id }
                ],
                status: "accepted"
            },
            include: {
                sender: {
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
            }
        });

        const friends = acceptedRequest.map(request => {
            const friend = request.senderId === req.user?.id ? request.receiver : request.sender;
            return friend;
        });

        res.status(200).json({
            code: 200,
            status: "success",
            message: "Daftar teman berhasil diambil",
            data: friends
        });
    } catch (error: any) {
        console.error("Error in get friend list", error.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

export const blockUser = async (req: Request, res: Response) => {
    try {
        const { userId: blockId } = req.body;

        if (!req.user) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        if (req.user.id === blockId) {
            return res.status(400).json({
                code: 400,
                status: "error",
                message: "Anda tidak dapat memblokir diri sendiri"
            });
        }

        const existingBlock = await prisma.blockedUser.findFirst({
            where: {
                blockerId: req.user.id,
                blockedId: blockId
            }
        });

        if (existingBlock) {
            return res.status(400).json({
                code: 400,
                status: "error",
                message: "Pengguna sudah diblokir sebelumnya"
            });
        }

        // Ubah status friend request yang ada menjadi blocked
        await prisma.friendRequest.updateMany({
            where: {
                OR: [
                    {
                        senderId: req.user.id,
                        receiverId: blockId,
                        status: {
                            in: ["pending", "accepted", "rejected"]
                        }
                    },
                    {
                        senderId: blockId,
                        receiverId: req.user.id,
                        status: {
                            in: ["pending", "accepted", "rejected"]
                        }
                    }
                ]
            },
            data: {
                status: "blocked"
            }
        });

        await prisma.conversation.deleteMany({
            where: {
                AND: [
                    {
                        participants: {
                            some: {
                                id: req.user.id
                            }
                        }
                    },
                    {
                        participants: {
                            some: {
                                id: blockId
                            }
                        }
                    }
                ]
            }
        });

        const blockRecord = await prisma.blockedUser.create({
            data: {
                blockerId: req.user.id,
                blockedId: blockId
            }
        });

        res.status(200).json({
            code: 200,
            status: "success",
            message: "Pengguna berhasil diblokir",
            data: blockRecord
        });
    } catch (error: any) {
        console.error("Error in block user", error.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

export const unblockUser = async (req: Request, res: Response) => {
    try {
        const { userId: unblockId } = req.body;

        if (!req.user) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const blockRecord = await prisma.blockedUser.findFirst({
            where: {
                blockerId: req.user.id,
                blockedId: unblockId
            }
        });

        if (!blockRecord) {
            return res.status(404).json({
                code: 404,
                status: "error",
                message: `pengguna ${unblockId} tidak ditemukan`
            });
        }

        await prisma.blockedUser.delete({
            where: {
                id: blockRecord.id
            }
        });

        res.status(200).json({
            code: 200,
            status: "success",
            message: "Pengguna berhasil di-unblock"
        });
    } catch (error: any) {
        console.error("Error in unblock user", error.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

export const getBlockedUsers = async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const blockedUsers = await prisma.blockedUser.findMany({
            where: {
                blockerId: req.user.id
            },
            include: {
                blocked: {
                    select: {
                        id: true,
                        username: true,
                        fullname: true,
                        profilePic: true
                    }
                }
            }
        });

        if (blockedUsers.length === 0) {
            return res.status(404).json({
                code: 404,
                status: "error",
                message: "Tidak ada pengguna yang diblokir"
            });
        }

        res.status(200).json({
            code: 200,
            status: "success",
            message: "Daftar pengguna yang diblokir",
            data: blockedUsers
        });
    } catch (error: any) {
        console.error("Error in get blocked users", error.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
};