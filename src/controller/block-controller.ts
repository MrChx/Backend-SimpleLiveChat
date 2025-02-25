import { Request, Response } from "express";
import prisma from "../db/prisma.js";

export const blockUser = async (req: Request, res: Response): Promise<void> => {
    try {
        const { userId: blockId, reason } = req.body;

        if (!req.user) {
            res.status(401).json({
                code: 401,
                status: "error",
                message: "Unauthorized"
            });
            return;
        }

        if (!blockId) {
            res.status(400).json({
                code: 400,
                status: "error",
                message: "Masukan ID yang akan di blokir"
            });
            return;
        }

        if (req.user.id === blockId) {
            res.status(400).json({
                code: 400,
                status: "error",
                message: "Anda tidak dapat memblokir diri sendiri"
            });
            return;
        }

        const userToBlock = await prisma.user.findUnique({
            where: { id: blockId }
        });

        if (!userToBlock) {
            res.status(404).json({
                code: 404,
                status: "error",
                message: "Pengguna yang akan diblokir tidak ditemukan"
            });
            return;
        }
        
        //cek jika sudah diblokir
        const existingBlock = await prisma.blockedUser.findFirst({
            where: {
                blockerId: req.user.id,
                blockedId: blockId
            }
        });

        if (existingBlock) {
            res.status(400).json({
                code: 400,
                status: "error",
                message: "Pengguna sudah diblokir sebelumnya"
            });
            return;
        }

        //ubah status block jika ada permintaan pertemanan
        await prisma.$transaction(async (tx) => {
            await tx.friendRequest.updateMany({
                where: {
                    OR: [
                        {
                            senderId: req.user!.id,
                            receiverId: blockId
                        },
                        {
                            senderId: blockId,
                            receiverId: req.user!.id
                        }
                    ]
                },
                data: {
                    status: "blocked"
                }
            });

            //hapus chat dengan user yang di block
            await tx.conversation.deleteMany({
                where: {
                    AND: [
                        {
                            participants: {
                                some: { id: req.user!.id }
                            }
                        },
                        {
                            participants: {
                                some: { id: blockId }
                            }
                        }
                    ]
                }
            });

            const blockRecord = await tx.blockedUser.create({
                data: {
                    blockerId: req.user!.id,
                    blockedId: blockId,
                    reason,
                    updatedAt: new Date()
                }
            });

            res.status(200).json({
                code: 200,
                status: "success",
                message: "Pengguna berhasil diblokir",
                data: blockRecord
            });
        });
    } catch (error: any) {
        console.error("Error in block user:", error.message);
        res.status(500).json({
            code: 500,
            status: "error",
            message: "Terjadi kesalahan di server",
            error: error.message
        });
    }
};

export const unblockUser = async (req: Request, res: Response): Promise<void> => {
    try {
        const { userId: unblockId } = req.body;

        if (!req.user) {
            res.status(401).json({
                code: 401, 
                status: "error",
                message: "Unauthorized"
            });
            return;
        }

        if (!unblockId) {
            res.status(400).json({
                code: 400,
                status: "error",
                message: "Masukan Id yang akan di-unblock"
            });
            return;
        }

        const userToUnblock = await prisma.user.findUnique({
            where: { id: unblockId }
        });

        if (!userToUnblock) {
            res.status(404).json({
                code: 404,
                status: "error",
                message: "Pengguna tidak ditemukan"
            });
            return;
        }

        const blockRecord = await prisma.blockedUser.findFirst({
            where: {
                blockerId: req.user.id,
                blockedId: unblockId
            }
        });

        if (!blockRecord) {
            res.status(404).json({
                code: 404,
                status: "error",
                message: "Pengguna ini tidak diblokir"
            });
            return;
        }

        // Use transaction to ensure data consistency
        await prisma.$transaction(async (tx) => {
            // Delete the block record
            await tx.blockedUser.delete({
                where: {
                    id: blockRecord.id
                }
            });

            await tx.friendRequest.updateMany({
                where: {
                    OR: [
                        {
                            senderId: req.user!.id,
                            receiverId: unblockId,
                            status: "blocked"
                        },
                        {
                            senderId: unblockId,
                            receiverId: req.user!.id,
                            status: "blocked" 
                        }
                    ]
                },
                data: {
                    status: "rejected" // Or could be reset to "pending" based on your preference
                }
            });
        });

        res.status(200).json({
            code: 200,
            status: "success",
            message: "Pengguna berhasil di-unblock",
            data: {
                id: userToUnblock.id,
                username: userToUnblock.username,
                createdAt: userToUnblock.createdAt,
                updateAt: userToUnblock.updatedAt
            }
        });
    } catch (error: any) {
        console.error("Error in unblock user:", error.message);
        res.status(500).json({
            code: 500, 
            status: "error",
            message: "Terjadi kesalahan di server",
            error: error.message
        });
    }
};

export const getBlockedUsers = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({
                code: 401,
                status: "error",
                message: "Unauthorized"
            });
            return;
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
            },
            orderBy: {
                createdAt: 'desc' // Menampilkan pengguna yang terakhir diblokir terlebih dahulu
            }
        });

        // Memberikan respons sukses meskipun daftar kosong (tidak ada yang diblokir)
        res.status(200).json({
            code: 200,
            status: "success",
            message: blockedUsers.length > 0 
                ? "Daftar pengguna yang diblokir" 
                : "Tidak ada pengguna yang diblokir",
            count: blockedUsers.length,
            data: blockedUsers.map(item => ({
                blockId: item.id,
                blockedAt: item.createdAt,
                reason: item.reason || null,
                user: item.blocked
            }))
        });
    } catch (error: any) {
        console.error("Error in get blocked users:", error.message);
        res.status(500).json({
            code: 500,
            status: "error",
            message: "Terjadi kesalahan di server",
            error: error.message
        });
    }
};