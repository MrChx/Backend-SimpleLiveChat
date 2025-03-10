import { Request, Response } from "express";
import prisma from "../db/prisma.js";

export const createGroup = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({
                code: 401,
                status: "error",
                message: "Unauthorized"
            });
        }

        const { name, members } = req.body;

        if (!name || typeof name !== 'string' || name.trim() === "") {
            return res.status(400).json({
                code: 400,
                status: "error",
                message: "Nama grup tidak boleh kosong"
            });
        }

        if (!Array.isArray(members)) {
            return res.status(400).json({
                code: 400,
                status: "error",
                message: "Format anggota tidak valid"
            });
        }

        if (members.length < 2) {
            return res.status(400).json({
                code: 400,
                status: "error",
                message: "Anggota grup minimal 2 orang"
            });
        }

        // Hapus duplikat dan pastikan format valid
        const uniqueMembers = [...new Set(members)];

        // Tambahkan admin ke daftar anggota jika belum ada
        const allMembersWithAdmin = uniqueMembers.includes(userId)
            ? uniqueMembers
            : [...uniqueMembers, userId];

        // Cek hubungan pertemanan
        const outgoingFriendships = await prisma.friendRequest.findMany({
            where: {
                AND: [
                    { senderId: userId },
                    { receiverId: { in: allMembersWithAdmin.filter(id => id !== userId) } },
                    { status: "accepted" },
                ],
            },
        });

        const incomingFriendships = await prisma.friendRequest.findMany({
            where: {
                AND: [
                    { receiverId: userId },
                    { senderId: { in: allMembersWithAdmin.filter(id => id !== userId) } },
                    { status: "accepted" },
                ],
            },
        });

        const allFriendIds = [
            ...outgoingFriendships.map((f) => f.receiverId),
            ...incomingFriendships.map((f) => f.senderId),
        ];

        const invalidMembers = allMembersWithAdmin
            .filter(id => id !== userId)
            .filter(id => !allFriendIds.includes(id));

        if (invalidMembers.length > 0) {
            return res.status(400).json({
                code: 400,
                status: "error",
                message: "Tidak bisa menambahkan anggota yang bukan teman",
                invalidMembers,
            });
        }

        // Buat grup percakapan
        const groupConversation = await prisma.groupConversation.create({
            data: {
                name: name.trim(),
                adminId: userId,
                members: {
                    connect: allMembersWithAdmin.map((memberId) => ({ id: memberId }))
                }
            },
            include: {
                admin: {
                    select: {
                        id: true,
                        username: true,
                        fullname: true,
                        profilePic: true,
                    },
                },
                members: {
                    select: {
                        id: true,
                        username: true,
                        fullname: true,
                        profilePic: true,
                        isOnline: true,
                        lastSeen: true,
                    },
                },
            },
        });

        return res.status(201).json({
            code: 201,
            status: "success",
            message: "Grup berhasil dibuat",
            data: groupConversation
        });
    } catch (error: any) {
        console.error("Error in create group :", error.message);
        res.status(500).json({
            code: 500,
            status: "error",
            message: "Terjadi kesalahan di server",
            error: error.message
        });
    }
};

export const addMember = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({
                status: "error",
                message: "Unauthorized",
            });
        }

        const { groupId } = req.params;
        const { userId: memberToAddId } = req.body;

        if (!memberToAddId || memberToAddId.trim() === "") {
            return res.status(400).json({
                code: 400,
                status: "error",
                message: "User ID harus di isi",
            });
        }

        const group = await prisma.groupConversation.findUnique({
            where: { id: groupId },
            include: {
                members: true,
            },
        });

        if (!group) {
            return res.status(404).json({
                code: 404,
                status: "error",
                message: "Grup tidak ditemukan",
            });
        }

        if (group.adminId !== userId) {
            return res.status(403).json({
                code: 403,
                status: "error",
                message: "Hanya admin grup yang dapat menambahkan anggota",
            });
        }

        if (group.members.some((member) => member.id === memberToAddId)) {
            return res.status(400).json({
                code: 400,
                status: "error",
                message: "User sudah menjadi anggota grup",
            });
        }

        const friendship = await prisma.friendRequest.findFirst({
            where: {
                OR: [
                    {
                        senderId: userId,
                        receiverId: memberToAddId,
                        status: "accepted",
                    },
                    {
                        senderId: memberToAddId,
                        receiverId: userId,
                        status: "accepted",
                    },
                ],
            },
        });

        if (!friendship) {
            return res.status(403).json({
                code: 403,
                status: "error",
                message: "User bukan teman Anda. Hanya teman yang dapat ditambahkan ke grup",
            });
        }

        const updatedGroup = await prisma.groupConversation.update({
            where: { id: groupId },
            data: {
                members: {
                    connect: { id: memberToAddId },
                },
            },
            include: {
                admin: {
                    select: {
                        id: true,
                        username: true,
                        fullname: true,
                        profilePic: true,
                    },
                },
                members: {
                    select: {
                        id: true,
                        username: true,
                        fullname: true,
                        profilePic: true,
                        isOnline: true,
                        lastSeen: true,
                    },
                },
            },
        });

        return res.status(200).json({
            code: 200,
            status: "success",
            message: "Anggota berhasil ditambahkan ke grup",
            data: updatedGroup,
        });
    } catch (error: any) {
        console.error("Error in add member :", error.message);
        res.status(500).json({
            code: 500,
            status: "error",
            message: "Terjadi kesalahan di server",
            error: error.message
        });
    }
};

export const removeMember = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        const { groupId } = req.params;
        const { userId: memberToRemoveId } = req.body;

        if (!userId) {
            return res.status(401).json({
                status: "error",
                message: "Unauthorized",
            });
        }

        if (!memberToRemoveId || memberToRemoveId.trim() === "") {
            return res.status(400).json({
                code: 400,
                status: "error",
                message: "User ID harus di isi",
            });
        }

        const group = await prisma.groupConversation.findUnique({
            where: { id: groupId },
            include: {
                members: true,
            },
        });

        if (!group) {
            return res.status(404).json({
                code: 404,
                status: "error",
                message: "Grup tidak ditemukan",
            });
        }

        if (group.adminId !== userId) {
            return res.status(403).json({
                code: 403,
                status: "error",
                message: "Hanya admin grup yang dapat menghapus anggota",
            });
        }

        if (memberToRemoveId === userId) {
            return res.status(400).json({
                code: 400,
                status: "error",
                message: "Admin tidak bisa menghapus diri sendiri dari grup. Gunakan fitur keluar grup",
            });
        }

        if (!group.members.some((member) => member.id === memberToRemoveId)) {
            return res.status(404).json({
                code: 404,
                status: "error",
                message: "Anggota tidak ditemukan dalam grup",
            });
        }

        const updatedGroup = await prisma.groupConversation.update({
            where: { id: groupId },
            data: {
                members: {
                    disconnect: { id: memberToRemoveId },
                },
            },
            include: {
                admin: {
                    select: {
                        id: true,
                        username: true,
                        fullname: true,
                        profilePic: true,
                    },
                },
                members: {
                    select: {
                        id: true,
                        username: true,
                        fullname: true,
                        profilePic: true,
                        isOnline: true,
                        lastSeen: true,
                    },
                },
            },
        });

        return res.status(200).json({
            code: 300,
            status: "success",
            message: "Anggota berhasil dihapus dari grup",
            data: updatedGroup,
        });
    } catch (error: any) {
        console.error("Error in remove member :", error.message);
        res.status(500).json({
            code: 500,
            status: "error",
            message: "Terjadi kesalahan di server",
            error: error.message
        });
    }
};

export const leaveGroup = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        const { groupId } = req.params;

        if (!userId) {
            return res.status(401).json({
                status: "error",
                message: "Unauthorized",
            });
        }

        const group = await prisma.groupConversation.findUnique({
            where: { id: groupId },
            include: {
                members: true,
            },
        });

        if (!group) {
            return res.status(404).json({
                code: 404,
                status: "error",
                message: "Grup tidak ditemukan",
            });
        }

        if (!group.members.some((member) => member.id === userId)) {
            return res.status(400).json({
                code: 400,
                status: "error",
                message: "Anda bukan anggota grup ini",
            });
        }

        //membuat opsi keluar grup untuk admin
        if (group.adminId === userId) {
            const otherMembers = group.members.filter((member) => member.id !== userId);

            if (otherMembers.length > 0) {
                const newAdminId = otherMembers[0].id;

                await prisma.groupConversation.update({
                    where: { id: groupId },
                    data: {
                        adminId: newAdminId,
                        members: {
                            disconnect: { id: userId },
                        },
                    },
                });

                return res.status(200).json({
                    code: 200,
                    status: "success",
                    message: "Anda berhasil keluar dari grup dan admin baru telah ditentukan",
                });
            } else {
                await prisma.groupConversation.delete({
                    where: { id: groupId },
                });

                return res.status(200).json({
                    code: 200,
                    status: "success",
                    message: "Grup berhasil dihapus karena tidak ada anggota lain",
                });
            }
        } else {
            await prisma.groupConversation.update({
                where: { id: groupId },
                data: {
                    members: {
                        disconnect: { id: userId },
                    },
                },
            });

            return res.status(200).json({
                code: 200,
                status: "success",
                message: "Anda berhasil keluar dari grup",
            });
        }
    } catch (error: any) {
        console.error("Error in leave group :", error.message);
        res.status(500).json({
            code: 500,
            status: "error",
            message: "Terjadi kesalahan di server",
            error: error.message
        });
    }
};

export const deletedGroup = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        const { groupId } = req.params;

        if (!userId) {
            return res.status(401).json({
                status: "error",
                message: "Unauthorized",
            });
        }

        const group = await prisma.groupConversation.findUnique({
            where: { id: groupId },
        });

        if (!group) {
            return res.status(404).json({
                code: 404,
                status: "error",
                message: "Grup tidak ditemukan",
            });
        }

        if (group.adminId !== userId) {
            return res.status(403).json({
                code: 403,
                status: "error",
                message: "Hanya admin grup yang dapat menghapus grup",
            });
        }

        await prisma.message.deleteMany({
            where: { groupId },
        });

        await prisma.groupConversation.delete({
            where: { id: groupId },
        });

        return res.status(200).json({
            code: 200,
            status: "success",
            message: "Grup berhasil dihapus",
        });
    } catch (error: any) {
        console.error("Error in delete group :", error.message);
        res.status(500).json({
            code: 500,
            status: "error",
            message: "Terjadi kesalahan di server",
            error: error.message
        });
    }
};

export const updateGroupInfo = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        const { groupId } = req.params;
        const { name, newAdminId } = req.body;

        if (!userId) {
            return res.status(401).json({
                status: "error",
                message: "Unauthorized",
            });
        }

        if (!name && !newAdminId) {
            return res.status(400).json({
                status: "error",
                message: "harus mengisi nama dan id user yang mau dijadikan admin",
            });
        }

        const group = await prisma.groupConversation.findUnique({
            where: { id: groupId },
            include: {
                members: true,
            },
        });

        if (!group) {
            return res.status(404).json({
                status: "error",
                message: "Grup tidak ditemukan",
            });
        }

        if (group.adminId !== userId) {
            return res.status(403).json({
                status: "error",
                message: "Hanya admin grup yang dapat mengupdate informasi grup",
            });
        }

        const updateData: any = {};

        if (name) {
            updateData.name = name;
        }

        if (newAdminId) {
            const isNewAdminMember = group.members.some((member) => member.id === newAdminId);

            if (!isNewAdminMember) {
                return res.status(404).json({
                    status: "error",
                    message: "User yang ditunjuk sebagai admin baru tidak ditemukan dalam grup",
                });
            }

            updateData.adminId = newAdminId;
        }

        const updatedGroup = await prisma.groupConversation.update({
            where: { id: groupId },
            data: updateData,
            include: {
                admin: {
                    select: {
                        id: true,
                        username: true,
                        fullname: true,
                        profilePic: true,
                    },
                },
                members: {
                    select: {
                        id: true,
                        username: true,
                        fullname: true,
                        profilePic: true,
                        isOnline: true,
                        lastSeen: true,
                    },
                },
            },
        });

        return res.status(200).json({
            status: "success",
            message: "Informasi grup berhasil diupdate",
            data: updatedGroup,
        });
    } catch (error: any) {
        console.error("Error in update group info :", error.message);
        res.status(500).json({
            code: 500,
            status: "error",
            message: "Terjadi kesalahan di server",
            error: error.message
        });
    }
};

export const getGroupMessage = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        const { groupId } = req.params;
        const { page = 1, limit = 20 } = req.query;

        const pageNum = Number(page);
        const limitNum = Number(limit);
        const skip = (pageNum - 1) * limitNum;

        if (!userId) {
            return res.status(401).json({
                status: "error",
                message: "Unauthorized",
            });
        }

        const group = await prisma.groupConversation.findUnique({
            where: { id: groupId },
            include: {
                members: {
                    select: {
                        id: true,
                    },
                },
            },
        });

        if (!group) {
            return res.status(404).json({
                status: "error",
                message: "Grup tidak ditemukan",
            });
        }

        const isMember = group.members.some((member) => member.id === userId);

        if (!isMember) {
            return res.status(403).json({
                status: "error",
                message: "Anda tidak memiliki akses ke pesan grup ini",
            });
        }

        const messages = await prisma.message.findMany({
            where: {
                groupId,
                NOT: {
                    deletedFor: {
                        has: userId,
                    },
                },
            },
            orderBy: {
                createdAt: "desc",
            },
            skip,
            take: limitNum,
            include: {
                sender: {
                    select: {
                        id: true,
                        username: true,
                        fullname: true,
                        profilePic: true,
                    },
                },
                reactions: {
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
                },
            },
        });

        const totalMessages = await prisma.message.count({
            where: {
                groupId,
                NOT: {
                    deletedFor: {
                        has: userId,
                    },
                },
            },
        });

        const unreadMessages = messages.filter(
            (message) => message.senderId !== userId && message.status !== "read"
        );

        if (unreadMessages.length > 0) {
            await prisma.$transaction(
                unreadMessages.map((message) =>
                    prisma.message.update({
                        where: { id: message.id },
                        data: { status: "read" },
                    })
                )
            );
        }

        return res.status(200).json({
            status: "success",
            data: {
                messages,
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    totalMessages,
                    totalPages: Math.ceil(totalMessages / limitNum),
                },
            },
        });
    } catch (error: any) {
        console.error("Error in get group message :", error.message);
        res.status(500).json({
            code: 500,
            status: "error",
            message: "Terjadi kesalahan di server",
            error: error.message
        });
    }
};

export const getGroupList = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        const { page = 1, limit = 10 } = req.query;

        const pageNum = Number(page);
        const limitNum = Number(limit);
        const skip = (pageNum - 1) * limitNum;

        if (!userId) {
            return res.status(401).json({
                status: "error",
                message: "Unauthorized",
            });
        }

        const groups = await prisma.groupConversation.findMany({
            where: {
                members: {
                    some: {
                        id: userId,
                    },
                },
            },
            orderBy: {
                updatedAt: "desc",
            },
            skip,
            take: limitNum,
            include: {
                admin: {
                    select: {
                        id: true,
                        username: true,
                        fullname: true,
                        profilePic: true,
                    },
                },
                members: {
                    select: {
                        id: true,
                        username: true,
                        fullname: true,
                        profilePic: true,
                        isOnline: true,
                        lastSeen: true,
                    },
                },
                messages: {
                    orderBy: {
                        createdAt: "desc",
                    },
                    take: 1,
                    include: {
                        sender: {
                            select: {
                                id: true,
                                username: true,
                                fullname: true,
                            },
                        },
                    },
                },
            },
        });

        const totalGroups = await prisma.groupConversation.count({
            where: {
                members: {
                    some: {
                        id: userId,
                    },
                },
            },
        });

        const groupsWithUnreadCount = await Promise.all(
            groups.map(async (group) => {
                const unreadCount = await prisma.message.count({
                    where: {
                        groupId: group.id,
                        senderId: {
                            not: userId,
                        },
                        status: {
                            not: "read",
                        },
                        NOT: {
                            deletedFor: {
                                has: userId,
                            },
                        },
                    },
                });

                return {
                    ...group,
                    unreadCount,
                };
            })
        );

        return res.status(200).json({
            status: "success",
            data: {
                groups: groupsWithUnreadCount,
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    totalGroups,
                    totalPages: Math.ceil(totalGroups / limitNum),
                },
            },
        });
    } catch (error: any) {
        console.error("Error in get group list :", error.message);
        res.status(500).json({
            code: 500,
            status: "error",
            message: "Terjadi kesalahan di server",
            error: error.message
        });
    }
};