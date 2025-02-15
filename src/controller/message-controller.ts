import { Request, Response } from "express";
import prisma from "../db/prisma.js";
import { getReceiverSocketId, io } from "../utils/socket.js";
import { deleteMessageFile } from "../utils/message-uploads.js";

export const sendMessage = async (req: Request, res: Response) => {
	try {
		const { message } = req.body;
		const { id: receiverId } = req.params;
		const file = req.file;

		if (!req.user) {
            if (file) {
                await deleteMessageFile(file.path);
            }
            return res.status(401).json({ error: "Unauthorized - User not found" });
        }

		if (!message && !file) {
            return res.status(400).json({
                code: 400,
                status: "error",
                message: "Pesan atau file harus diisi"
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
            if (file) {
                await deleteMessageFile(file.path);
            }
            return res.status(404).json({
                code: 404,
                status: "error",
                message: "User penerima tidak ditemukan"
            });
        }

		let conversation = await prisma.conversation.findFirst({
            where: {
                participants: {
                    every: {
                        id: {
                            in: [senderId, receiverId]
                        }
                    }
                }
            }
        });

		if (!conversation) {
            conversation = await prisma.conversation.create({
                data: {
                    participants: {
                        connect: [
                            { id: senderId },
                            { id: receiverId }
                        ]
                    }
                }
            });
        }

		let fileData = null;
        if (file) {
            fileData = {
                fileUrl: `/pic/${file.filename}`,
                fileName: file.originalname,
                fileType: file.mimetype
            };
        }

		const newMessage = await prisma.message.create({
            data: {
                senderId: req.user.id,
                body: message || null,
                conversationId: conversation.id,
                ...(fileData && {
                    fileUrl: fileData.fileUrl,
                    fileName: fileData.fileName,
                    fileType: fileData.fileType
                })
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

export const updateMessageStatus = async (req: Request, res: Response) => {
    try {
        const { messageId } = req.params;
        const { status } = req.body;

        if (!req.user) {
            return res.status(401).json({ error: "Unauthorized - User not found" });
        }

        if (!["sent", "delivered", "read"].includes(status)) {
            return res.status(400).json({
                code: 400,
                status: "error",
                message: "Status pesan tidak valid"
            });
        }

        const message = await prisma.message.findUnique({
            where: { id: messageId },
            include: {
                conversation: {
                    select: {
                        participants: {
                            select: {
                                id: true
                            }
                        }
                    }
                }
            }
        });

        if (!message) {
            return res.status(404).json({
                code: 404,
                status: "error",
                message: "Pesan tidak ditemukan"
            });
        }

        const participantIds = message.conversation?.participants.map(participant => participant.id);
        if (!participantIds?.includes(req.user.id) || message.senderId === req.user.id) {
            return res.status(403).json({
                code: 403,
                status: "error",
                message: "Tidak memiliki izin untuk mengubah status pesan"
            });
        }

        const updatedMessage = await prisma.message.update({
            where: { id: messageId },
            data: { status }
        });

        const senderSocketId = getReceiverSocketId(message.senderId);
        if (senderSocketId) {
            io.to(senderSocketId).emit("messageStatusUpdate", {
                messageId,
                status,
                updatedAt: updatedMessage.updatedAt
            });
        }

        res.status(200).json({
            code: 200,
            status: "success",
            message: "Status pesan berhasil diperbarui",
            data: updatedMessage
        });

    } catch (error) {
        console.error("Error in updateMessageStatus:", error);
        res.status(500).json({
            code: 500,
            status: "error",
            message: "Internal server error"
        });
    }
};

export const updateConversationMessageStatus = async (req: Request, res: Response) => {
    try {
        const { conversationId } = req.params;
        const { status } = req.body;

        if (!req.user) {
            return res.status(401).json({
                code: 401,
                status: "error",
                message: "Unauthorized"
            });
        }

        if (!["delivered", "read"].includes(status)) {
            return res.status(400).json({
                code: 400,
                status: "error",
                message: "Status tidak valid. Gunakan: delivered atau read"
            });
        }

        const conversation = await prisma.conversation.findUnique({
            where: { id: conversationId },
            include: {
                participants: {
                    select: {
                        id: true
                    }
                }
            }
        });

        if (!conversation) {
            return res.status(404).json({
                code: 404,
                status: "error",
                message: "Percakapan tidak ditemukan"
            });
        }

        const participantIds = conversation.participants.map(participant => participant.id);
        if (!participantIds.includes(req.user.id)) {
            return res.status(403).json({
                code: 403,
                status: "error",
                message: "Tidak memiliki izin untuk mengubah status pesan"
            });
        }

        const updatedMessages = await prisma.message.updateMany({
            where: {
                conversationId,
                senderId: {
                    not: req.user.id
                },
                status: {
                    in: status === "read" ? ["sent", "delivered"] : ["sent"]
                }
            },
            data: { status }
        });

        const messages = await prisma.message.findMany({
            where: {
                conversationId,
                senderId: {
                    not: req.user.id
                }
            }
        });

        messages.forEach(message => {
            const senderSocketId = getReceiverSocketId(message.senderId);
            if (senderSocketId) {
                io.to(senderSocketId).emit("messageStatusUpdate", {
                    messageId: message.id,
                    status,
                    updatedAt: new Date()
                });
            }
        });

        res.status(200).json({
            code: 200,
            status: "success",
            message: `${updatedMessages.count} pesan telah diperbarui statusnya menjadi ${status}`,
            data: {
                updatedCount: updatedMessages.count,
                status
            }
        });

    } catch (error) {
        console.error("Error in updateConversationMessageStatus:", error);
        res.status(500).json({
            code: 500,
            status: "error",
            message: "Internal server error"
        });
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
                participants: {
                    every: {
                        id: {
                            in: [senderId, userToChatId]
                        }
                    }
                }
            },
            include: {
                messages: {
                    where: {
                        deletedFor: {
                            hasEvery: []
                        }
                    },
                    orderBy: {
                        createdAt: "asc"
                    }
                }
            }
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

export const editMessage = async (req: Request, res: Response) => {
    try {
        const { messageId } = req.params;
        const { message } = req.body;

        // Debug log 1: Check incoming request
        // console.log('Edit Message Request:', {
        //     messageId,
        //     userId: req.user?.id,
        //     newMessage: message
        // });

        if (!message) {
            return res.status(400).json({
                code: 400,
                status: "error",
                message: "Pesan tidak boleh kosong"
            });
        }

        if (!req.user) {
            return res.status(401).json({ 
                code: 401,
                status: "error",
                message: "Unauthorized - User not found" 
            });
        }

        const existingMessage = await prisma.message.findUnique({
            where: { id: messageId },
        });

        // console.log('Existing Message:', {
        //     message: existingMessage,
        //     requestUserId: req.user.id,
        //     isOwner: existingMessage?.senderId === req.user.id
        // });

        if (!existingMessage) {
            return res.status(404).json({
                code: 404,
                status: "error",
                message: "Pesan tidak ditemukan"
            });
        }

        // Explicit comparison for ownership check
        const isMessageOwner = existingMessage.senderId === req.user.id;
        // console.log('Ownership Check:', {
        //     messageSenderId: existingMessage.senderId,
        //     currentUserId: req.user.id,
        //     isOwner: isMessageOwner
        // });

        if (!isMessageOwner) {
            return res.status(403).json({
                code: 403,
                status: "error",
                message: "Anda tidak memiliki izin untuk mengedit pesan ini",
                debug: {
                    messageSenderId: existingMessage.senderId,
                    currentUserId: req.user.id
                }
            });
        }

        const updatedMessage = await prisma.message.update({
            where: { id: messageId },
            data: { 
                body: message,
                updatedAt: new Date()
            }
        });

        // console.log('Updated Message:', updatedMessage);

        const receiverSocketId = getReceiverSocketId(existingMessage.senderId);
        if (receiverSocketId) {
            io.to(receiverSocketId).emit("messageUpdated", updatedMessage);
        }

        res.status(200).json({
            code: 200,
            status: "success",
            message: "Pesan berhasil diupdate",
            data: updatedMessage
        });
    } catch (error: any) {
        console.error("Error in editMessage: ", error.message);
        res.status(500).json({ 
            code: 500,
            status: "error",
            message: "Internal server error",
            debug: error.message
        });
    }
};

interface DeleteMessageRequest extends Request {
    body: {
        deleteFor: 'me' | 'all';
    }
}

export const deleteMessage = async (req: DeleteMessageRequest, res: Response) => {
    try {
        const { messageId } = req.params;
        const { deleteFor } = req.body;
        
        if (!req.user) {
            return res.status(401).json({ 
                code: 401,
                status: "error", 
                message: "Unauthorized - User not found" 
            });
        }

        const message = await prisma.message.findUnique({
            where: { id: messageId },
            include: {
                conversation: {
                    include: {
                        participants: {
                            select: {
                                id: true
                            }
                        }
                    }
                }
            }
        });

        if (!message) {
            return res.status(404).json({
                code: 404,
                status: "error",
                message: "Pesan tidak ditemukan"
            });
        }

        if (deleteFor === 'all' && message.senderId !== req.user.id) {
            return res.status(403).json({
                code: 403,
                status: "error",
                message: "Tidak dapat menghapus pesan orang lain untuk semua orang"
            });
        }

        let result;
        if (deleteFor === 'all') {
            if (message.fileUrl) {
                await deleteMessageFile(message.fileUrl);
            }

            result = await prisma.message.delete({
                where: { id: messageId }
            });

            if (message.conversation?.participants) {
                message.conversation.participants.forEach(participant => {
                    const receiverSocketId = getReceiverSocketId(participant.id);
                    if (receiverSocketId) {
                        io.to(receiverSocketId).emit("messageDeleted", {
                            messageId,
                            deleteFor: 'all',
                            deleteBy: req.user?.id
                        });
                    }
                });
            }
        } else {
            result = await prisma.message.update({
                where: { id: messageId },
                data: {
                    deletedFor: {
                        push: req.user.id
                    }
                }
            });

            const receiverSocketId = getReceiverSocketId(req.user.id);
            if (receiverSocketId) {
                io.to(receiverSocketId).emit("messageDeleted", {
                    messageId,
                    deleteFor: 'me',
                    deleteBy: req.user.id
                });
            }
        }

        res.status(200).json({
            code: 200,
            status: "success",
            message: deleteFor === 'all' ? 
                "Pesan berhasil dihapus untuk semua orang" : 
                "Pesan berhasil dihapus untuk Anda",
            data: result
        });

    } catch (error: any) {
        console.error("Error in deleteMessage: ", error.message);
        res.status(500).json({ 
            code: 500,
            status: "error",
            message: "Internal server error",
            error: error.message
        });
    }
};