import { describe, it, expect, beforeEach } from "@jest/globals";
import request from "supertest";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { app } from "../app.js";
import { PaymentModel } from "../models/payment.model.js";

const JWT_SECRET = process.env.JWT_SECRET || "test_isolated_jwt_secret_12345";

const generateToken = (userId = new mongoose.Types.ObjectId().toString(), role = "USER") => {
    return jwt.sign({ id: userId, roles: role }, JWT_SECRET, { expiresIn: "1h" });
};

describe("GET /api/payments/:id", () => {
    beforeEach(() => {
        // cleanup handled in setup.js
    });

    it("should fetch payment record when buyer accesses their own payment (200)", async () => {
        const userId = new mongoose.Types.ObjectId().toString();
        const token = generateToken(userId, "USER");

        const payment = await PaymentModel.create({
            order: new mongoose.Types.ObjectId(),
            user: userId,
            razorpay_order_id: "order_get_123",
            amount: 750,
            currency: "INR",
            status: "pending",
        });

        const res = await request(app)
            .get(`/api/payments/${payment._id}`)
            .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.payment._id).toBe(payment._id.toString());
    });

    it("should prevent User A from fetching User B's payment (403 Forbidden)", async () => {
        const userA = new mongoose.Types.ObjectId().toString();
        const userB = new mongoose.Types.ObjectId().toString();
        const userBToken = generateToken(userB, "USER");

        const paymentA = await PaymentModel.create({
            order: new mongoose.Types.ObjectId(),
            user: userA,
            razorpay_order_id: "order_get_456",
            amount: 1200,
            currency: "INR",
            status: "pending",
        });

        const res = await request(app)
            .get(`/api/payments/${paymentA._id}`)
            .set("Authorization", `Bearer ${userBToken}`);

        expect(res.status).toBe(403);
        expect(res.body.success).toBe(false);
    });

    it("should allow ADMIN to fetch any payment record (200 OK)", async () => {
        const userA = new mongoose.Types.ObjectId().toString();
        const adminId = new mongoose.Types.ObjectId().toString();
        const adminToken = generateToken(adminId, "ADMIN");

        const paymentA = await PaymentModel.create({
            order: new mongoose.Types.ObjectId(),
            user: userA,
            razorpay_order_id: "order_get_789",
            amount: 999,
            currency: "INR",
            status: "pending",
        });

        const res = await request(app)
            .get(`/api/payments/${paymentA._id}`)
            .set("Authorization", `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it("should return 404 if payment ID does not exist", async () => {
        const userId = new mongoose.Types.ObjectId().toString();
        const token = generateToken(userId, "USER");
        const nonExistentId = new mongoose.Types.ObjectId().toString();

        const res = await request(app)
            .get(`/api/payments/${nonExistentId}`)
            .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(404);
        expect(res.body.success).toBe(false);
    });

    it("should return 400 for invalid ObjectId format", async () => {
        const userId = new mongoose.Types.ObjectId().toString();
        const token = generateToken(userId, "USER");

        const res = await request(app)
            .get("/api/payments/invalid-mongo-id")
            .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
    });
});
