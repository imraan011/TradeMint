import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import request from "supertest";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { app } from "../app.js";
import { PaymentModel } from "../models/payment.model.js";

const JWT_SECRET = process.env.JWT_SECRET || "test_isolated_jwt_secret_12345";
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

const generateToken = (userId = new mongoose.Types.ObjectId().toString(), role = "USER") => {
    return jwt.sign({ id: userId, roles: role }, JWT_SECRET, { expiresIn: "1h" });
};

describe("POST /api/payments/verify", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("should successfully verify payment with valid signature", async () => {
        const userId = new mongoose.Types.ObjectId().toString();
        const orderId = new mongoose.Types.ObjectId().toString();
        const token = generateToken(userId);

        const rzpOrderId = "order_test_123";
        const rzpPaymentId = "pay_test_456";

        // Generate genuine signature using current env secret
        const genuineSignature = crypto
            .createHmac("sha256", RAZORPAY_KEY_SECRET)
            .update(`${rzpOrderId}|${rzpPaymentId}`)
            .digest("hex");

        // Seed pending payment record in in-memory DB
        await PaymentModel.create({
            order: orderId,
            user: userId,
            razorpay_order_id: rzpOrderId,
            amount: 500,
            currency: "INR",
            status: "pending",
        });

        const res = await request(app)
            .post("/api/payments/verify")
            .set("Authorization", `Bearer ${token}`)
            .send({
                razorpay_order_id: rzpOrderId,
                razorpay_payment_id: rzpPaymentId,
                razorpay_signature: genuineSignature,
            });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.payment.status).toBe("completed");
        expect(res.body.payment.razorpay_payment_id).toBe(rzpPaymentId);
    });

    it("should reject verification when signature is invalid or tampered (400)", async () => {
        const token = generateToken();

        const res = await request(app)
            .post("/api/payments/verify")
            .set("Authorization", `Bearer ${token}`)
            .send({
                razorpay_order_id: "order_fake",
                razorpay_payment_id: "pay_fake",
                razorpay_signature: "tampered_fake_signature",
            });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
    });

    it("should return 401 when Authorization header is missing", async () => {
        const res = await request(app)
            .post("/api/payments/verify")
            .send({
                razorpay_order_id: "order_test",
                razorpay_payment_id: "pay_test",
                razorpay_signature: "sig_test",
            });

        expect(res.status).toBe(401);
    });
});
