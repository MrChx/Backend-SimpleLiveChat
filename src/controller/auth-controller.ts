import jwt from "jsonwebtoken";
import { Request, Response } from 'express';
import prisma from "../db/prisma.js";
import bcryptjs from "bcryptjs";
import fs from "fs-extra";
import path from "path";
import { upload } from "../index.js";

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

export const register = async (req: Request, res: Response) => {
    upload.single("profilePic")(req, res, async (err) => {
        if (err) {
            return res.status(400).json({ 
                code: 400, 
                status: "error", 
                message: err.message 
            });
        }

        try {
            const { fullname, username, password, confirmpassword, gender } = req.body;
            const profilePic = req.file ? req.file.filename : null;

            if (!fullname || !username || !password || !confirmpassword || !gender) {
                return res.status(400).json({
                    code: 400,
                    status: "error",
                    message: "Masukkan semua kolom yang diperlukan"
                });
            }

            if (password !== confirmpassword) {
                return res.status(400).json({
                    code: 400,
                    status: "error",
                    message: "Password dan konfirmasi password tidak sama"
                });
            }

            const userExists = await prisma.user.findUnique({ where: { username } });
            if (userExists) {
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

            const imagePath = profilePic ? `/pict/${profilePic}` : defaultProfilePic;

            const newUser = await prisma.user.create({
                data: {
                    fullname,
                    username,
                    password: hashPassword,
                    gender,
                    profilePic: imagePath
                }
            });

            if (newUser) {
                const token = jwt.sign({ id: newUser.id }, "your-secret-key", { expiresIn: "1d" });

                res.status(201).json({
                    code: 201,
                    status: "success",
                    message: "Daftar akun berhasil",
                    token,
                    user: {
                        id: newUser.id,
                        fullname: newUser.fullname,
                        username: newUser.username,
                        gender: newUser.gender,
                        profilePic: newUser.profilePic
                    }
                });
            } else {
                res.status(500).json({
                    code: 500,
                    status: "error",
                    message: "Gagal membuat user"
                });
            }
        } catch (error) {
            console.error("Error in register controller:");
            res.status(500).json({ code: 500, status: "error", message: "Internal Server Error" });
        }
    });
};

export const login = async (req: Request, res: Response) => {
    try {
        const {username, password} = req.body;

        if (!username || !password) {
            return res.status(400).json({
                code: 400,
                status: "error",
                message: "masukan username dan password"
            });
        }

        const user = await prisma.user.findUnique({where: {username: username}});

        if (!user) {
            return res.status(400).json({
                code: 400,
                status: "error",
                message: "User tidak ditemukan"
            })
        }

        const isPasswordMatch = await bcryptjs.compare(password, user.password);

        if (!isPasswordMatch) {
            return res.status(400).json({
                code: 400,
                status: "error",
                message: "password salah"
            })
        }

        generateToken(user.id, res);

        const token = jwt.sign({ id: user.id }, "your-secret-key", { expiresIn: "1d" });

        res.status(200).json({
            code:200,
            status: "success",
            massage: "login berhasil",
            token: token,
            data: {
                id: user.id,
                fullname: user.fullname,
                username: user.username,
                gender: user.gender,
                profilePic: user.profilePic
            }
        });

    } catch (error: any) {
        console.log("Error in login controller", error.message);
        res.status(500).json({ error: "Internal Server Error" });
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

export const updateUser = async (req: Request, res: Response) => {
    try {
        const { fullname, username, gender, profilePic, oldPassword, newPassword } = req.body;

        if (!req.user || !req.user.id) {
            return res.status(400).json({
                code: 400,
                status: "error",
                message: "User ID tidak tersedia dalam request"
            });
        }

        const user = await prisma.user.findUnique({ where: { id: req.user.id } });

        if (!user) {
            return res.status(404).json({
                code: 404,
                status: "error",
                message: "User tidak ditemukan"
            });
        }

        if (fullname || username || gender || profilePic) {
            const updatedUser = await prisma.user.update({
                where: { id: req.user.id },
                data: {
                    fullname,
                    username,
                    gender,
                    profilePic
                }
            });

            return res.status(200).json({
                code: 200,
                status: "success",
                message: "Profil berhasil diperbarui",
                data: updatedUser
            });
        }

        if (oldPassword && newPassword) {
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
        }

        return res.status(400).json({
            code: 400,
            status: "error",
            message: "Tidak ada data yang diperbarui"
        });

    } catch (error: any) {
        console.log("Error in signup controller", error.message);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

export const logout = async (req: Request, res: Response) => {
    try {
        res.cookie("jwt", "", { maxAge: 0 });
		res.status(200).json({ message: "Logged out successfully" });
    } catch (error: any) {
        console.log("Error in signup controller", error.message);
        res.status(500).json({ error: "Internal Server Error" });
    }
}


