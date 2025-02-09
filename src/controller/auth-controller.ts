import jwt from "jsonwebtoken";
import { Request, Response } from 'express';
import prisma from "../db/prisma.js";
import bcryptjs from "bcryptjs";
import fs from "fs-extra";
import path from "path";
import { upload } from "../index.js";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fileUtils = {
    deleteFile: async (filePath: string) => {
        try {
            if (!filePath.includes('avatar.iran.liara.run')) {
                const fullPath = path.join(__dirname, '../../src/pic', path.basename(filePath));
                if (await fs.pathExists(fullPath)) {
                    await fs.unlink(fullPath);
                }
            }
        } catch (error) {
            console.error('Error deleting file:', error);
        }
    }
};

const generateToken = (userId: string, res: Response) => {
    const token = jwt.sign({ userId }, process.env.JWT_SECRET!, {
		expiresIn: "1d",
	});
    
    res.cookie("jwt", token, {
        maxAge: 1 * 24 * 60 * 60 * 1000,
		httpOnly: true, 
		sameSite: "strict", 
		secure: process.env.NODE_ENV !== "development"
    });

    return token;
};

const FILE_CONFIG = {
    maxSize: 5 * 1024 * 1024, // 5MB
    allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'],
    errorMessages: {
        size: 'Ukuran file terlalu besar. Maksimal 5MB',
        type: 'Format file tidak didukung. Gunakan JPEG, JPG, PNG, atau GIF'
    }
};

export const register = async (req: Request, res: Response) => {
    upload.single('profilePic')(req, res, async (err) => {
        if (err) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({
                    code: 400,
                    status: "error",
                    message: FILE_CONFIG.errorMessages.size
                });
            }
            return res.status(400).json({
                code: 400,
                status: "error",
                message: FILE_CONFIG.errorMessages.type
            });
        }

        try {
            const { fullname, username, password, confirmpassword, gender } = req.body;
            const profilePic = req.file;

            if (!fullname || !username || !password || !confirmpassword || !gender) {
                if (profilePic) {
                    await fileUtils.deleteFile(profilePic.path);
                }
                return res.status(400).json({
                    code: 400,
                    status: "error",
                    message: "Masukkan semua kolom yang diperlukan"
                });
            }

            if (password !== confirmpassword) {
                if (profilePic) {
                    await fileUtils.deleteFile(profilePic.path);
                }
                return res.status(400).json({
                    code: 400,
                    status: "error",
                    message: "Password dan konfirmasi password tidak sama"
                });
            }

            const userExists = await prisma.user.findUnique({ where: { username } });
            if (userExists) {
                if (profilePic) {
                    await fileUtils.deleteFile(profilePic.path);
                }
                return res.status(400).json({
                    code: 400,
                    status: "error",
                    message: "Username sudah ada"
                });
            }

            const salt = await bcryptjs.genSalt(10);
            const hashPassword = await bcryptjs.hash(password, salt);

            const boyProfilePic = `https://avatar.iran.liara.run/public/boy?username=${username}`;
            const girlProfilePic = `https://avatar.iran.liara.run/public/girl?username=${username}`;
            const defaultProfilePic = gender === "male" ? boyProfilePic : girlProfilePic;

            const imagePath = profilePic ? `/pic/${profilePic.filename}` : defaultProfilePic;

            const newUser = await prisma.user.create({
                data: {
                    fullname,
                    username,
                    password: hashPassword,
                    gender,
                    profilePic: imagePath
                }
            });

            const token = generateToken(newUser.id, res);

            res.status(201).json({
                code: 201,
                status: "success",
                message: "Daftar akun berhasil",
                token: token,
                data: {
                    id: newUser.id,
                    fullname: newUser.fullname,
                    username: newUser.username,
                    gender: newUser.gender,
                    profilePic: newUser.profilePic
                }
            });
        } catch (error) {
            if (req.file) {
                await fileUtils.deleteFile(req.file.path);
            }
            console.error("Error in register controller:", error);
            res.status(500).json({ code: 500, status: "error", message: "Internal Server Error" });
        }
    });
};

export const login = async (req: Request, res: Response) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                code: 400,
                status: "error",
                message: "Username dan password harus diisi"
            });
        }

        const user = await prisma.user.findUnique({ where: { username } });

        if (!user) {
            return res.status(400).json({
                code: 400,
                status: "error",
                message: "Username salah"
            });
        }

        const storedPassword: string = user.password.toString();
        
        const isPasswordMatch = await bcryptjs.compare(password.toString(), storedPassword);

        if (!isPasswordMatch) {
            return res.status(400).json({
                code: 400,
                status: "error",
                message: "Password salah"
            });
        }

        const token = generateToken(user.id, res);

        res.status(200).json({
            code: 200,
            status: "success",
            message: "Login berhasil",
            token : token,
            data: {
                id: user.id,
                fullname: user.fullname,
                username: user.username,
                gender: user.gender,
                profilePic: user.profilePic
            }
        });

    } catch (error) {
        console.error("Error in login controller:", error);
        res.status(500).json({ 
            code: 500, 
            status: "error", 
            message: "Internal Server Error" 
        });
    }
};

export const getUser = async (req: Request, res: Response) => {
    try {
        if (!req.user || !req.user.id) {
            return res.status(400).json({
                code: 400,
                status: "error",
                message: "User ID tidak tersedia dalam request"
            });
        }

        const user = await prisma.user.findUnique({ 
            where: { id: req.user.id },
            select: {
                id: true,
                fullname: true,
                username: true,
                gender: true,
                profilePic: true
            }
        });

        if (!user) {
            return res.status(404).json({
                code: 404,
                status: "error",
                message: "User tidak ditemukan"
            });
        }

        return res.status(200).json({
            code: 200,
            status: "success",
            data: user
        });
    } catch (error: any) {
        console.log("Error in getUser controller", error.message);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

export const updateProfile = async (req: Request, res: Response) => {
    upload.single('profilePic')(req, res, async (err) => {
        if (err) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({
                    code: 400,
                    status: "error",
                    message: FILE_CONFIG.errorMessages.size
                });
            }
            return res.status(400).json({
                code: 400,
                status: "error",
                message: FILE_CONFIG.errorMessages.type
            });
        }

        try {
            const { fullname, username, gender } = req.body;
            const profilePic = req.file;

            if (!req.user?.id) {
                if (profilePic) {
                    await fileUtils.deleteFile(profilePic.path);
                }
                return res.status(401).json({
                    code: 401,
                    status: "error",
                    message: "Unauthorized"
                });
            }

            const user = await prisma.user.findUnique({ 
                where: { id: req.user.id },
                select: {
                    id: true,
                    username: true,
                    fullname: true,
                    gender: true,
                    profilePic: true
                }
            });

            if (!user) {
                if (profilePic) {
                    await fileUtils.deleteFile(profilePic.path);
                }
                return res.status(404).json({
                    code: 404,
                    status: "error",
                    message: "User tidak ditemukan"
                });
            }

            let updateData: any = {};

            if (fullname) updateData.fullname = fullname;
            if (username) updateData.username = username;
            if (gender) updateData.gender = gender;

            if (profilePic) {
                if (user.profilePic && !user.profilePic.includes('avatar.iran.liara.run')) {
                    const oldPicPath = path.join(__dirname, '../../src/pic', path.basename(user.profilePic));
                    if (await fs.pathExists(oldPicPath)) {
                        await fs.unlink(oldPicPath);
                    }
                }
                updateData.profilePic = `/pic/${profilePic.filename}`;
            } //delete old profile

            if (Object.keys(updateData).length === 0) {
                return res.status(400).json({
                    code: 400,
                    status: "error",
                    message: "Tidak ada data yang diperbarui"
                });
            }

            const updatedUser = await prisma.user.update({
                where: { id: req.user.id },
                data: updateData,
                select: {
                    id: true,
                    username: true,
                    fullname: true,
                    gender: true,
                    profilePic: true
                }
            });

            return res.status(200).json({
                code: 200,
                status: "success",
                message: "Profil berhasil diperbarui",
                data: updatedUser
            });

        } catch (error) {
            if (req.file) {
                await fileUtils.deleteFile(req.file.path);
            }
            console.error("Error in updateProfile controller:", error);
            res.status(500).json({ 
                code: 500, 
                status: "error", 
                message: "Internal Server Error" 
            });
        }
    });
};

export const updatePassword = async (req: Request, res: Response) => {
    try {
        if (!req.user?.id) {
            return res.status(401).json({
                code: 401,
                status: "error",
                message: "Unauthorized"
            });
        }

        const { oldPassword, newPassword, confirmPassword } = req.body;

        if (!oldPassword || !newPassword || !confirmPassword) {
            return res.status(400).json({
                code: 400,
                status: "error",
                message: "Semua kolom password harus diisi"
            });
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({
                code: 400,
                status: "error",
                message: "Password baru dan konfirmasi password tidak sama"
            });
        }

        const user = await prisma.user.findUnique({ 
            where: { id: req.user.id },
            select: {
                id: true,
                password: true
            }
        });

        if (!user) {
            return res.status(404).json({
                code: 404,
                status: "error",
                message: "User tidak ditemukan"
            });
        }

        const isMatch = await bcryptjs.compare(oldPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({
                code: 400,
                status: "error",
                message: "Password lama salah"
            });
        }

        const hashedPassword = await bcryptjs.hash(newPassword, 10);

        await prisma.user.update({
            where: { id: req.user.id },
            data: { password: hashedPassword }
        });

        return res.status(200).json({
            code: 200,
            status: "success",
            message: "Password berhasil diperbarui"
        });

    } catch (error) {
        console.error("Error in updatePassword controller:", error);
        res.status(500).json({ 
            code: 500, 
            status: "error", 
            message: "Internal Server Error" 
        });
    }
};

export const logout = async (req: Request, res: Response) => {
    try {
        res.cookie("jwt", "", { maxAge: 0 });
		res.status(200).json({ message: "Logout berhasil" });
    } catch (error: any) {
        console.log("Error in signup controller", error.message);
        res.status(500).json({ error: "Internal Server Error" });
    }
}


