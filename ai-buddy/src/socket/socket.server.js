import { Server } from "socket.io";
import { parseCookie } from "cookie";
import jwt from "jsonwebtoken";
import { agent } from "../agent/agent.js";

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
            socket.token = token; // Token ko socket object me store karo
            next();
        } catch (error) {
            console.warn("Socket connection rejected: Invalid token -", error.message);
            return next(new Error("Authentication error: Invalid token"));
        }
    });

    io.on("connection", (socket) => {
        console.log(`User connected to AI-Buddy: ${socket.user?.id || socket.id}`);
        

        socket.on("message", async (data) => {
            console.log(`Message received from ${socket.user?.id || socket.id}: ${data}`);
            try {
                const agentResponse = await agent.invoke(
                    {
                        messages: [
                            {
                                role: "user",
                                content: data,
                            },
                        ],
                    },
                    {
                        metadata: {
                            token: socket.token,
                        },
                        configurable: {
                            token: socket.token,
                        },
                    },
                );

                const lastMessage = agentResponse.messages[agentResponse.messages.length - 1];
                const replyText = typeof lastMessage?.content === "string" 
                    ? lastMessage.content 
                    : JSON.stringify(lastMessage?.content);

                console.log("\n====== AGENT RESPONSE ======");
                console.log(replyText);
                console.log("============================\n");

                socket.emit("message", replyText || "No response");
            } catch (error) {
                console.error("Error in agent invocation:", error);
                socket.emit("error", { message: error.message || "Failed to process message" });
            }
        });

        socket.on("disconnect", () => {
            console.log(`User disconnected: ${socket.id}`);
        });
    });

    return io;
}
