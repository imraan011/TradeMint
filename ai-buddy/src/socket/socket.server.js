import { Server } from "socket.io";
import { parseCookie } from "cookie";
import jwt from "jsonwebtoken";

export function initSocketServer(httpServer) {
    const io = new Server(httpServer, {
        cors: {
            origin: "*",
            credentials: true,
        },
    });

    io.use((socket, next) => {
        // 1. Cookie se token nikalo
        const rawCookie = socket.handshake.headers.cookie;
        const parsedCookies = rawCookie ? parseCookie(rawCookie) : {};

        // 2. Token cookie, auth payload ya authorization header teeno se check karo
        const token =
            parsedCookies.token ||
            parsedCookies.accessToken ||
            socket.handshake.auth?.token ||
            socket.handshake.headers.authorization?.split(" ")[1];

        if (!token) {
            console.warn("Socket connection rejected: No token provided");
            return next(new Error("Authentication error: No token provided"));
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            socket.user = decoded;
            next();
        } catch (error) {
            console.warn("Socket connection rejected: Invalid token -", error.message);
            return next(new Error("Authentication error: Invalid token"));
        }
    });

    io.on("connection", (socket) => {
        console.log(`User connected to AI-Buddy: ${socket.user?.id || socket.id}`);

        socket.on("disconnect", () => {
            console.log(`User disconnected: ${socket.id}`);
        });
    });

    return io;
}
