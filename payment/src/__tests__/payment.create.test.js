import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import request from "supertest";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import axios from "axios";
import { app } from "../app.js";
import razorpay from "../config/razorpay.js";

const JWT_SECRET = process.env.JWT_SECRET || "test_isolated_jwt_secret_12345";

const generateToken = (userId = new mongoose.Types.ObjectId().toString(), role = "USER") => {
    return jwt.sign({ id: userId, roles: role }, JWT_SECRET, { expiresIn: "1h" });
};

describe("POST /payments/razorpay/order (or current /api/payments/create/:orderId)", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("should create razorpay order when external order service succeeds", async () => {
        const userId = new mongoose.Types.ObjectId().toString();
        const orderId = new mongoose.Types.ObjectId().toString();
        const token = generateToken(userId);

        // Mock Order service response
        jest.spyOn(axios, "get").mockResolvedValueOnce({
            data: {
                success: true,
                order: {
                    _id: orderId,
                    totalAmount: 500,
                    currency: "INR",
                },
            },
        });

        // Mock Razorpay order creation
        jest.spyOn(razorpay.orders, "create").mockResolvedValueOnce({
            id: "order_mock12345",
            amount: 50000,
            currency: "INR",
            receipt: `receipt_${orderId}`,
        });

        const res = await request(app)
            .post(`/api/payments/create/${orderId}`)
            .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.payment.razorpay_order_id).toBe("order_mock12345");
        expect(res.body.payment.amount).toBe(500);
        expect(res.body.payment.status).toBe("pending");
    });

    it("should return 401 when authorization token is missing", async () => {
        const orderId = new mongoose.Types.ObjectId().toString();

        const res = await request(app).post(`/api/payments/create/${orderId}`);

        expect(res.status).toBe(401);
        expect(res.body.success).toBe(false);
    });

    it("should handle error when order service fails or returns error", async () => {
        const orderId = new mongoose.Types.ObjectId().toString();
        const token = generateToken();

        jest.spyOn(axios, "get").mockRejectedValueOnce(new Error("Order service unavailable"));

        const res = await request(app)
            .post(`/api/payments/create/${orderId}`)
            .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(500);
        expect(res.body.error).toBeDefined();
    });
});
