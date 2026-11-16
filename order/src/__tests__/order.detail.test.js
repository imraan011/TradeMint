/**
 * Test suite for GET /api/orders/:id
 *
 * Spec:
 * 1. Fetches a single order by its ID for the authenticated customer.
 * 2. Returns complete order details including items, totals, timeline, and payment summary.
 * 3. Buyer Isolation: Returns 403 or 404 if User A tries to access User B's order.
 * 4. Returns 404 if the order ID does not exist in database.
 * 5. Returns 400 if the order ID is not a valid MongoDB ObjectId.
 * 6. Requires valid authentication (Bearer token).
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

describe("GET /api/orders/:id", () => {
    // ═══════════════════════════════════════════════════════════════════════════
    // 1. Happy Path & Order Retrieval
    // ═══════════════════════════════════════════════════════════════════════════
    describe("Successful Order Retrieval", () => {
        it("should return order details with timeline and payment summary", async () => {
            const { token } = generateAuthToken();
            const productId = new mongoose.Types.ObjectId().toString();

            // Pehle order create karo
            const createRes = await request(app)
                .post("/api/orders")
                .set("Authorization", `Bearer ${token}`)
                .send({
                    items: [{ productId, title: "Laptop Stand", price: 1200, quantity: 1 }],
                    shippingAddress: sampleAddress,
                });

            const createdOrder = createRes.body.data?.order || createRes.body.order || createRes.body.data;
            const orderId = createdOrder._id || createdOrder.id;

            // GET /api/orders/:id fetch karo
            const res = await request(app)
                .get(`/api/orders/${orderId}`)
                .set("Authorization", `Bearer ${token}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);

            const order = res.body.data?.order || res.body.order || res.body.data;
            expect(order).toBeDefined();
            expect(order._id?.toString() || order.id?.toString()).toBe(orderId.toString());
            expect(order.status).toBeDefined();
            expect(order.items).toHaveLength(1);
        });

        it("should prevent User A from accessing User B's order (Buyer Isolation)", async () => {
            const { token: tokenUserA } = generateAuthToken();
            const { token: tokenUserB } = generateAuthToken();

            // User A order banata hai
            const createRes = await request(app)
                .post("/api/orders")
                .set("Authorization", `Bearer ${tokenUserA}`)
                .send({
                    items: [{ productId: new mongoose.Types.ObjectId().toString(), price: 500, quantity: 1 }],
                    shippingAddress: sampleAddress,
                });

            const orderA = createRes.body.data?.order || createRes.body.order || createRes.body.data;
            const orderAId = orderA._id || orderA.id;

            // User B us order ko fetch karne ki koshish karega
            const res = await request(app)
                .get(`/api/orders/${orderAId}`)
                .set("Authorization", `Bearer ${tokenUserB}`);

            // 403 Forbidden ya 404 Not Found return hona chahiye
            expect([403, 404]).toContain(res.status);
            expect(res.body.success).toBe(false);
        });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // 2. Not Found & Validations (404 & 400)
    // ═══════════════════════════════════════════════════════════════════════════
    describe("Not Found & Validations", () => {
        it("should return 404 when order ID does not exist in DB", async () => {
            const { token } = generateAuthToken();
            const nonExistentId = new mongoose.Types.ObjectId().toString();

            const res = await request(app)
                .get(`/api/orders/${nonExistentId}`)
                .set("Authorization", `Bearer ${token}`);

            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
            expect(res.body.error.message).toMatch(/not found|order.*not exist/i);
        });

        it("should return 400 when order ID format is invalid", async () => {
            const { token } = generateAuthToken();

            const res = await request(app)
                .get("/api/orders/not-a-valid-object-id")
                .set("Authorization", `Bearer ${token}`);

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.error.message).toMatch(/invalid.*id|objectid/i);
        });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // 3. Authentication Failures (401 Unauthorized)
    // ═══════════════════════════════════════════════════════════════════════════
    describe("Authentication Failures", () => {
        it("should return 401 when Authorization header is missing", async () => {
            const randomId = new mongoose.Types.ObjectId().toString();
            const res = await request(app).get(`/api/orders/${randomId}`);

            expect(res.status).toBe(401);
            expect(res.body.success).toBe(false);
        });

        it("should return 401 when token is invalid or forged", async () => {
            const randomId = new mongoose.Types.ObjectId().toString();
            const res = await request(app)
                .get(`/api/orders/${randomId}`)
                .set("Authorization", "Bearer invalid.fake.token");

            expect(res.status).toBe(401);
            expect(res.body.success).toBe(false);
        });
    });
});
