import jwt, { JwtPayload } from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import prisma from "../db/prisma.js";

interface DecodedToken extends JwtPayload {
    userId: string;
}

declare global {
    namespace Express {
        export interface Request {
            user?: {
                id: string;
                username?: string;
                fullname?: string;
                profilePic?: string | null ;
            };
        }
    }
}

const protectRoute = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        // Get token from Authorization header as fallback
        const authHeader = req.headers.authorization;
        let token = req.cookies?.jwt;

        if (!token && authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.split(' ')[1];
        }

        if (!token) {
            res.status(401).json({ 
                code: 401,
                status: "error",
                message: "Unauthorized - No token provided" 
            });
            return;
        }

        try {
            const decoded = jwt.verify(
                token, 
                process.env.JWT_SECRET || 'fallback-secret-key'
            ) as DecodedToken;

            const user = await prisma.user.findUnique({
                where: { id: decoded.userId },
                select: { id: true, username: true, fullname: true, profilePic: true },
            });

            if (!user) {
                res.status(404).json({ 
                    code: 404,
                    status: "error",
                    message: "User not found" 
                });
                return;
            }

            req.user = user;
            next();
        } catch (jwtError) {
            res.status(401).json({ 
                code: 401,
                status: "error",
                message: "Unauthorized - Invalid Token" 
            });
            return;
        }
    } catch (error) {
        console.error("Error in protectRoute middleware:", error);
        res.status(500).json({ 
            code: 500,
            status: "error",
            message: "Internal Server Error" 
        });
    }
};

export default protectRoute;