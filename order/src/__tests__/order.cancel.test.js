/**
 * Test suite for POST /api/orders/:id/cancel
 *
 * Spec:
 * 1. Buyer-initiated cancellation for an order.
 * 2. Allowed when order status is "pending" or "paid".
 * 3. Updates order status to "cancelled" (and logs cancel reason if provided).
 * 4. Rejects with 400 if order is already "shipped", "delivered", or "cancelled".
 * 5. Returns 404 if order does not exist.
 * 6. Returns 400 for invalid ObjectId format.
 * 7. Buyer Isolation: Returns 403 if User A tries to cancel User B's order.
 * 8. Requires valid authentication (Bearer token).
 */

import { describe, it, expect } from "@jest/globals";
import "dotenv/config";
import request from "supertest";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { app } from "../app.js";

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
    phone: "9876543210",
};

describe("POST /api/orders/:id/cancel", () => {
    // ═══════════════════════════════════════════════════════════════════════════
    // 1. Happy Path & Order Cancellation
    // ═══════════════════════════════════════════════════════════════════════════
    describe("Successful Order Cancellation", () => {
        it("should allow buyer to cancel a pending order", async () => {
            const { token } = generateAuthToken();
            const productId = new mongoose.Types.ObjectId().toString();

            // Order create karo (status=pending)
            const createRes = await request(app)
                .post("/api/orders")
                .set("Authorization", `Bearer ${token}`)
                .send({
                    items: [{ productId, title: "Book", price: 300, quantity: 1 }],
                    shippingAddress: sampleAddress,
                });

            const createdOrder = createRes.body.data?.order || createRes.body.order || createRes.body.data;
            const orderId = createdOrder._id || createdOrder.id;

            // Cancel API call karo
            const res = await request(app)
                .post(`/api/orders/${orderId}/cancel`)
                .set("Authorization", `Bearer ${token}`)
                .send({ reason: "Ordered by mistake" });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);

            const order = res.body.data?.order || res.body.order || res.body.data;
            expect(order.status).toBe("cancelled");
        });

        it("should prevent User A from cancelling User B's order", async () => {
            const { token: userAToken } = generateAuthToken();
            const { token: userBToken } = generateAuthToken();

            // User A order banata hai
            const createRes = await request(app)
                .post("/api/orders")
                .set("Authorization", `Bearer ${userAToken}`)
                .send({
                    items: [{ productId: new mongoose.Types.ObjectId().toString(), price: 500, quantity: 1 }],
                    shippingAddress: sampleAddress,
                });

            const orderA = createRes.body.data?.order || createRes.body.order || createRes.body.data;
            const orderAId = orderA._id || orderA.id;

            // User B cancel karne ki koshish karega
            const res = await request(app)
                .post(`/api/orders/${orderAId}/cancel`)
                .set("Authorization", `Bearer ${userBToken}`);

            expect([403, 404]).toContain(res.status);
            expect(res.body.success).toBe(false);
        });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // 2. Business Rules & Validations (400 Bad Request)
    // ═══════════════════════════════════════════════════════════════════════════
    describe("Business Rules & Validations", () => {
        it("should return 400 when attempting to cancel an already cancelled order", async () => {
            const { token } = generateAuthToken();

            const createRes = await request(app)
                .post("/api/orders")
                .set("Authorization", `Bearer ${token}`)
                .send({
                    items: [{ productId: new mongoose.Types.ObjectId().toString(), price: 200, quantity: 1 }],
                    shippingAddress: sampleAddress,
                });

            const order = createRes.body.data?.order || createRes.body.order || createRes.body.data;
            const orderId = order._id || order.id;

            // First cancel (succeeds)
            await request(app)
                .post(`/api/orders/${orderId}/cancel`)
                .set("Authorization", `Bearer ${token}`);

            // Second cancel (must fail with 400)
            const res = await request(app)
                .post(`/api/orders/${orderId}/cancel`)
                .set("Authorization", `Bearer ${token}`);

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.error.message).toMatch(/already.*cancel/i);
        });

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
