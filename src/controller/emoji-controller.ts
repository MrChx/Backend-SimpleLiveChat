import { Request, Response } from "express";
import prisma from "../db/prisma.js";

export const addReaction = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        const { messageId, emoji } = req.body;

        if (!userId) {
            return res.status(401).json({
                code: 401,
                status: "error",
                message: "Unauthorized",
            });
        }

        if (!messageId || !emoji) {
            return res.status(400).json({
                code: 400,
                status: "error",
                message: "Message ID dan emoji harus diisi",
            });
        }

        const reaction = await prisma.reaction.create({
            data: {
                messageId,
                userId,
                emoji,
            },
        });

        return res.status(201).json({
            code: 201,
            status: "success",
            message: "Reaction berhasil ditambahkan",
            data: reaction,
        });
    } catch (error: any) {
        console.error("Error in addReaction:", error.message);
        res.status(500).json({
            code: 500,
            status: "error",
            message: "Terjadi kesalahan di server",
        });
    }
};

export const removeReaction = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        const { id } = req.params;

        if (!userId) {
            return res.status(401).json({
                code: 401,
                status: "error",
                message: "Unauthorized",
            });
        }

        const reaction = await prisma.reaction.findUnique({
            where: { id },
        });

        if (!reaction) {
            return res.status(404).json({
                code: 404,
                status: "error",
                message: "Reaction tidak ditemukan",
            });
        }

        if (reaction.userId !== userId) {
            return res.status(403).json({
                code: 403,
                status: "error",
                message: "Anda tidak memiliki izin untuk menghapus reaction ini",
            });
        }

        await prisma.reaction.delete({
            where: { id },
        });

        return res.status(200).json({
            code: 200,
            status: "success",
            message: "Reaction berhasil dihapus",
        });
    } catch (error: any) {
        console.error("Error in removeReaction:", error.message);
        res.status(500).json({
            code: 500,
            status: "error",
            message: "Terjadi kesalahan di server",
        });
    }
};

export const getReactions = async (req: Request, res: Response) => {
    try {
        const { messageId } = req.params;

        const reactions = await prisma.reaction.findMany({
            where: { messageId },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        fullname: true,
                        profilePic: true,
                    },
                },
            },
        });

        return res.status(200).json({
            code: 200,
            status: "success",
            data: reactions,
        });
    } catch (error: any) {
        console.error("Error in getReactions:", error.message);
        res.status(500).json({
            code: 500,
            status: "error",
            message: "Terjadi kesalahan di server",
        });
    }
};