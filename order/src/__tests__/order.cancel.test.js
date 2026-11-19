/**
 * Test suite for POST /api/orders/:id/cancel
 *
 * Spec:
 * 1. Buyer-initiated cancellation for an order.
 * 2. Allowed when order status is "pending".
 * 3. Updates order status to "cancelled".
 * 4. Rejects with 400 if order is already "cancelled".
 * 5. Returns 404 if order does not exist.
 * 6. Returns 400 for invalid ObjectId format.
 * 7. Buyer Isolation: Returns 403 if User A tries to cancel User B's order.
 * 8. Requires valid authentication (Bearer token).
 *
 * Pattern: OrderModel.create() se DB seed karo — no POST /api/orders needed.
 * Client kabhi items/prices send nahi karta (CWE-472).
 */

import { describe, it, expect } from "@jest/globals";
import "dotenv/config";
import request from "supertest";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { app } from "../app.js";
import OrderModel from "../models/order.model.js";

const JWT_SECRET = process.env.JWT_SECRET || "test_jwt_secret";

const generateAuthToken = (customId = null, role = "USER") => {
    const payload = {
        id: customId || new mongoose.Types.ObjectId().toString(),
        username: "test_buyer",
        email: "buyer@cartopia.com",
        roles: role,
    };
    return {
        token: jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" }),
        user: payload,
    };
};

const sampleAddress = {
    street: "123 MG Road",
    city: "Bengaluru",
    state: "Karnataka",
    pincode: "560001",
    country: "India",
};

/** DB seed helper */
const seedOrder = (userId, overrides = {}) =>
    OrderModel.create({
        user: userId,
        shippingAddress: sampleAddress,
        items: [
            {
                productId: new mongoose.Types.ObjectId(),
                quantity: 1,
                price: { amount: 300, currency: "INR" },
            },
        ],
        status: "pending",
        totalAmount: 404,
        tax: 54,
        shippingCharges: 50,
        ...overrides,
    });

describe("POST /api/orders/:id/cancel", () => {
    // ═══════════════════════════════════════════════════════════════════════════
    // 1. Happy Path & Order Cancellation
    // ═══════════════════════════════════════════════════════════════════════════
    describe("Successful Order Cancellation", () => {
        it("should allow buyer to cancel a pending order", async () => {
            const { token, user } = generateAuthToken();

            const seeded = await seedOrder(user.id);

            const res = await request(app)
                .post(`/api/orders/${seeded._id}/cancel`)
                .set("Authorization", `Bearer ${token}`)
                .send({ reason: "Ordered by mistake" });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);

            const order = res.body.data?.order ?? res.body.order ?? res.body.data;
            expect(order.status).toBe("canceled");
        });

        it("should prevent User A from cancelling User B's order (403)", async () => {
            const { user: userA } = generateAuthToken();
            const { token: userBToken } = generateAuthToken();

            // User A ka order DB mein daal do
            const seeded = await seedOrder(userA.id);

            // User B cancel karne ki koshish karega
            const res = await request(app)
                .post(`/api/orders/${seeded._id}/cancel`)
                .set("Authorization", `Bearer ${userBToken}`)
                .send({ reason: "Trying to cancel someone else's order" });

            expect(res.status).toBe(403);
            expect(res.body.success).toBe(false);
        });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // 2. Business Rules & Validations (400 Bad Request)
    // ═══════════════════════════════════════════════════════════════════════════
    describe("Business Rules & Validations", () => {
        // it("should return 400 when attempting to cancel an already cancelled order", async () => {
        //     const { token, user } = generateAuthToken();

        //     // already-cancelled order seed karo
        //     const seeded = await seedOrder(user.id, { status: "canceled" });

        //     const res = await request(app)
        //         .post(`/api/orders/${seeded._id}/cancel`)
        //         .set("Authorization", `Bearer ${token}`);

        //     expect(res.status).toBe(400);
        //     expect(res.body.success).toBe(false);
        //     expect(res.body.error.message).toMatch(/already.*canceled/i);
        // });

        it("should return 404 when order does not exist", async () => {
            const { token } = generateAuthToken();
            const nonExistentId = new mongoose.Types.ObjectId().toString();

            const res = await request(app)
                .post(`/api/orders/${nonExistentId}/cancel`)
                .set("Authorization", `Bearer ${token}`);

            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
        });

        it("should return 400 when order ID format is invalid", async () => {
            const { token } = generateAuthToken();

            const res = await request(app)
                .post("/api/orders/invalid-object-id/cancel")
                .set("Authorization", `Bearer ${token}`);

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.error.message).toMatch(/invalid.*id/i);
        });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // 3. Authentication Failures (401 Unauthorized)
    // ═══════════════════════════════════════════════════════════════════════════
    describe("Authentication Failures", () => {
        it("should return 401 when Authorization header is missing", async () => {
            const randomId = new mongoose.Types.ObjectId().toString();
            const res = await request(app).post(`/api/orders/${randomId}/cancel`);

            expect(res.status).toBe(401);
            expect(res.body.success).toBe(false);
        });

        it("should return 401 when token is invalid or expired", async () => {
            const randomId = new mongoose.Types.ObjectId().toString();
            const res = await request(app)
                .post(`/api/orders/${randomId}/cancel`)
                .set("Authorization", "Bearer invalid.fake.token");

            expect(res.status).toBe(401);
            expect(res.body.success).toBe(false);
        });
    });
});
