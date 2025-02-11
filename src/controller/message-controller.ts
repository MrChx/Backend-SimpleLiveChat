import { Request, Response } from "express";
import prisma from "../db/prisma.js";
import { getReceiverSocketId, io } from "../utils/socket.js";

export const sendMessage = async (req: Request, res: Response) => {
	try {
		const { message } = req.body;
		const { id: receiverId } = req.params;
		if (!req.user) {
            return res.status(401).json({ error: "Unauthorized - User not found" });
        }

		if(!message) {
			return res.status(400).json({
				code: 400,
				status: "error",
				message: "pesan tidak boleh kosong"
			});
		}

		if(!receiverId) {
			return res.status(400).json({
				code: 400,
				status: "error",
				message: "id penerima tidak valid"
			})
		}

        const senderId = req.user.id;

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

		let conversation = await prisma.conversation.findFirst({
			where: {
				partipantsIds: {
					hasEvery: [senderId, receiverId],
				},
			},
		});

		if (!conversation) {
			conversation = await prisma.conversation.create({
				data: {
					partipantsIds: {
						set: [senderId, receiverId],
					},
				},
			});
		}

		const newMessage = await prisma.message.create({
			data: {
				senderId,
				body: message,
				conversationId: conversation.id,
			},
		});

		if (newMessage) {
			conversation = await prisma.conversation.update({
				where: {
					id: conversation.id,
				},
				data: {
					messages: {
						connect: {
							id: newMessage.id,
						},
					},
				},
			});
		}

		const receiverSocketId = getReceiverSocketId(receiverId);

		if (receiverSocketId) {
			io.to(receiverSocketId).emit("newMessage", newMessage);
		}

		res.status(201).json({
			code : 201,
			status : "succes",
			message : "pesan berhasil dikirim",
			data : newMessage
		});
	} catch (error: any) {
		console.error("Error in sendMessage: ", error.message);
		res.status(500).json({ error: "Internal server error" });
	}
};

export const getMessages = async (req: Request, res: Response) => {
	try {
		const { id: userToChatId } = req.params;

		if(!userToChatId) {
			return res.status(400).json({
				code: 400,
				status: "error",
				message: "id penerima tidak valid"
			})
		}

		if (!req.user) {
            return res.status(401).json({ error: "Unauthorized - User not found" });
        }
        const senderId = req.user.id;

		const userExists = await prisma.user.findUnique({
			where: { id: userToChatId },
		});

		if(!userExists) {
			return res.status(404).json({
				code: 404,
				status: "error",
				message: "User penerima tidak ditemukan"
			});
		}

		const conversation = await prisma.conversation.findFirst({
			where: {
				partipantsIds: {
					hasEvery: [senderId, userToChatId],
				},
			},
			include: {
				messages: {
					orderBy: {
						createdAt: "asc",
					},
				},
			},
		});

		if (!conversation) {
			return res.status(200).json({
				code: 200,
				status: "success",
				message: "belum ada percakapan",
				data: []
			});
		}

		res.status(200).json({
			code: 200,
			status: "success",
			message: "berhasil mendapatkan pesan",
			data: conversation.messages
		})
	} catch (error: any) {
		console.error("Error in getMessages: ", error.message);
		res.status(500).json({ error: "Internal server error" });
	}
};

export const getUsersForSidebar = async (req: Request, res: Response) => {
	try {
        
        if (!req.user) {
            return res.status(401).json({ error: "Unauthorized - User not found" });
        }
        const authUserId = req.user.id;

		const users = await prisma.user.findMany({
			where: {
				id: {
					not: authUserId,
				},
			},
			select: {
				id: true,
				fullname: true,
				profilePic: true,
			},
		});

		res.status(200).json({
			code: 200,
			status: "success",
			message: "berhasil mendapatkan data user",
			data: users
		})
	} catch (error: any) {
		console.error("Error in getUsersForSidebar: ", error.message);
		res.status(500).json({ error: "Internal server error" });
	}
};