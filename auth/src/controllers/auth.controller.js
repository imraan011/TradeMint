import "dotenv/config";
import { compare, hash } from "bcryptjs";
import { createRequire } from "module";
import { randomBytes } from "crypto";
import { userModel } from "../models/user.model.js";
import { redis } from "../db/redis.js";
import { publishToQueue } from "../broker/broker.js";

// jwt CJS hai — ESM default import me .sign undefined aata hai, isliye createRequire
const require = createRequire(import.meta.url);
const jwt = require("jsonwebtoken");

// Production me env se aayega. Dev/test me har restart pe naya random secret —
// hardcode se kahin better, source code se guess nahi ho sakta.
const JWT_SECRET = process.env.JWT_SECRET ?? randomBytes(32).toString("hex");
const JWT_REFRESH_SECRET =
    process.env.JWT_REFRESH_SECRET ?? randomBytes(32).toString("hex");

// Auth tokens generate karke cookie set karta hai aur response bhejta hai
function sendAuthResponse(res, user, statusCode = 200) {
    const accessToken = jwt.sign(
        {
            id: user._id,
            username: user.username,
            email: user.email,
            roles: user.roles,
        },
        JWT_SECRET,
        { expiresIn: "15m" },
    );

    const refreshToken = jwt.sign({ id: user._id }, JWT_REFRESH_SECRET, {
        expiresIn: "7d",
    });

    res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(statusCode).json({
        success: true,
        data: {
            accessToken,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                roles: user.roles,
            },
        },
    });
}

// register karta hai naya user
export async function registerUser(req, res) {
    try {
        const { username, email, password, fullname, roles } = req.body;

        // email/username duplicate check
        const existing = await userModel.findOne({
            $or: [{ email }, { username }],
        });
        if (existing) {
            const field = existing.email === email ? "email" : "username";
            return res.status(409).json({
                success: false,
                error: { message: `${field} is already taken` },
            });
        }

        // password hash karo — cost factor 10
        const hashedPassword = await hash(password, 10);

        const user = await userModel.create({
            username,
            email,
            password: hashedPassword,
            fullname,
            roles: roles ?? "USER",
        });

        // notification publish to queue with event name AUTH_NOTIFICATION.USER_CREATED in rabbitmq
        await publishToQueue("AUTH_NOTIFICATION.USER_CREATED", {
            id: user._id,
            username: user.username,
            email: user.email,
            fullname: user.fullname,

        });

        return sendAuthResponse(res, user, 201);
    } catch (error) {
        console.error("Error in registerUser:", error);
        return res.status(500).json({
            success: false,
            error: { message: "Internal server error" },
        });
    }
}

// login karta hai existing user
export async function loginUser(req, res) {
    try {
        const { username, email, password } = req.body;

        const user = await userModel
            .findOne({
                $or: [{ email }, { username }],
            })
            .select("+password"); // password field ko explicitly select karo

        if (!user) {
            return res.status(401).json({
                success: false,
                error: { message: "Invalid credentials" },
            });
        }

        const isPasswordValid = await compare(password, user.password);

        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                error: { message: "Invalid credentials" },
            });
        }

        return sendAuthResponse(res, user, 200);
    } catch (error) {
        console.error("Error in loginUser:", error);
        return res.status(500).json({
            success: false,
            error: { message: "Internal server error" },
        });
    }
}

// current authenticated user profile fetch karta hai
export async function getMe(req, res) {
    try {
        const user = await userModel.findById(req.user.id).select("-password");
        if (!user) {
            return res.status(404).json({
                success: false,
                error: { message: "User not found" },
            });
        }

        return res.status(200).json({
            success: true,
            data: { user },
        });
    } catch (error) {
        console.error("Error in getMe:", error);
        return res.status(500).json({
            success: false,
            error: { message: "Internal server error" },
        });
    }
}

// refresh cookie clear karke logout karta hai
export async function logoutUser(req, res) {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
        return res.status(400).json({
            success: false,
            error: { message: "No refresh token provided" },
        });
    }

    await redis.set(
        `blacklist:${refreshToken}`,
        "true",
        "EX",
        7 * 24 * 60 * 60,
    ); // 7 days in seconds

    res.clearCookie("refreshToken");
    return res.status(200).json({
        success: true,
    });
}

// user ke addresses fetch karta hai
export async function getUserAddresses(req, res) {
    try {
        const userId = req.user.id;
        const user = await userModel.findById(userId).select("addresses");

        if (!user) {
            return res.status(404).json({
                success: false,
                error: { message: "User not found" },
            });
        }

        return res.status(200).json({
            success: true,
            data: { addresses: user.addresses ?? [] },
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: { message: "Internal server error" },
        });
    }
}

// user ke addresses me naya address add karta hai
export async function addUserAddress(req, res) {
    try {
        const userId = req.user.id;
        const { street, city, state, pincode, country, phone, isDefault } =
            req.body;

        const user = await userModel.findOneAndUpdate(
            { _id: userId },
            {
                $push: {
                    addresses: {
                        street,
                        city,
                        state,
                        pincode,
                        country,
                        phone,
                        isDefault,
                    },
                },
            },
            { returnDocument: "after" },
        );

        if (!user) {
            return res.status(404).json({
                success: false,
                error: { message: "User not found" },
            });
        }

        const addedAddress = user.addresses[user.addresses.length - 1];

        return res.status(201).json({
            success: true,
            data: {
                address: addedAddress,
                addresses: user.addresses,
            },
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: { message: "Internal server error" },
        });
    }
}

// user ka address delete karta hai
export async function deleteUserAddress(req, res) {
    try {
        const userId = req.user.id;
        const { addressId } = req.params;

        const user = await userModel
            .findOneAndUpdate(
                { _id: userId, "addresses._id": addressId },
                { $pull: { addresses: { _id: addressId } } },
                { returnDocument: "after" },
            )
            .select("addresses");

        if (!user) {
            return res.status(404).json({
                success: false,
                error: { message: "User not found" },
            });
        }

        return res.status(200).json({
            success: true,
            data: { addresses: user.addresses },
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: { message: "Internal server error" },
        });
    }
}
