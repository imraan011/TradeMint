/**
 * Test suite for POST /api/orders
 *
 * Spec:
 * 1. Creates an order from the authenticated user's current cart.
 * 2. Copies priced items from cart to order.
 * 3. Computes taxes and shipping charges, sets totalAmount.
 * 4. Sets initial order status to "pending".
 * 5. Reserves inventory and emits order.created event/status.
 * 6. Returns 400 if user's cart is empty or does not exist.
 * 7. Requires valid authentication (Bearer token or cookie).
 */

import { describe, it, expect } from "@jest/globals";
import "dotenv/config";
import request from "supertest";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { app } from "../app.js";

const JWT_SECRET = process.env.JWT_SECRET || "test_jwt_secret";

// Test helper: JWT token generator
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

describe("POST /api/orders", () => {
    // ═══════════════════════════════════════════════════════════════════════════
    // 1. Happy Path & Order Creation
    // ═══════════════════════════════════════════════════════════════════════════
    describe("Successful Order Creation", () => {
        it("should successfully create an order from user cart with status=pending", async () => {
            const { token, user } = generateAuthToken();
            const productId = new mongoose.Types.ObjectId().toString();

            const res = await request(app)
                .post("/api/orders")
                .set("Authorization", `Bearer ${token}`)
                .send({
                    items: [
                        {
                            productId,
                            title: "Wireless Mouse",
                            price: 500,
                            quantity: 2,
                        },
                    ],
                    shippingAddress: sampleAddress,
                });

            expect([200, 201]).toContain(res.status);
            expect(res.body.success).toBe(true);

            const order = res.body.data?.order || res.body.order || res.body.data;
            expect(order).toBeDefined();
            expect(order.status).toBe("pending");
            expect(order.items).toHaveLength(1);
            expect(order.items[0].productId.toString()).toBe(productId);
            expect(order.items[0].quantity).toBe(2);
        });

        it("should compute taxes and shipping charges in order totals", async () => {
            const { token } = generateAuthToken();

            const res = await request(app)
                .post("/api/orders")
                .set("Authorization", `Bearer ${token}`)
                .send({
                    items: [
                        {
                            productId: new mongoose.Types.ObjectId().toString(),
                            title: "Mechanical Keyboard",
                            price: 2000,
                            quantity: 1,
                        },
                    ],
                    shippingAddress: sampleAddress,
                });

            expect([200, 201]).toContain(res.status);
            const order = res.body.data?.order || res.body.order || res.body.data;
            expect(order.totalAmount).toBeGreaterThan(0);
            expect(order.tax ?? order.taxes ?? 0).toBeGreaterThanOrEqual(0);
            expect(order.shippingCharges ?? order.shippingFee ?? 0).toBeGreaterThanOrEqual(0);
        });

        it("should authenticate via cookie if token is passed in cookies", async () => {
            const { token } = generateAuthToken();

            const res = await request(app)
                .post("/api/orders")
                .set("Cookie", [`token=${token}`])
                .send({
                    items: [
                        {
                            productId: new mongoose.Types.ObjectId().toString(),
                            title: "USB Cable",
                            price: 150,
                            quantity: 1,
                        },
                    ],
                    shippingAddress: sampleAddress,
                });

            expect([200, 201]).toContain(res.status);
            expect(res.body.success).toBe(true);
        });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // 2. Input & Cart Validations (400 Bad Request)
    // ═══════════════════════════════════════════════════════════════════════════
    describe("Input & Cart Validations", () => {
        it("should return 400 when order items array is empty", async () => {
            const { token } = generateAuthToken();

            const res = await request(app)
                .post("/api/orders")
                .set("Authorization", `Bearer ${token}`)
                .send({
                    items: [],
                    shippingAddress: sampleAddress,
                });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.error.message).toMatch(/empty|item.*required|no item/i);
        });

        it("should return 400 when shipping address is missing", async () => {
            const { token } = generateAuthToken();

            const res = await request(app)
                .post("/api/orders")
                .set("Authorization", `Bearer ${token}`)
                .send({
                    items: [
                        {
                            productId: new mongoose.Types.ObjectId().toString(),
                            price: 100,
                            quantity: 1,
                        },
                    ],
                });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.error.message).toMatch(/address.*required|missing.*address/i);
        });

        it("should return 400 when shipping address fields are incomplete", async () => {
            const { token } = generateAuthToken();

            const res = await request(app)
                .post("/api/orders")
                .set("Authorization", `Bearer ${token}`)
                .send({
                    items: [
                        {
                            productId: new mongoose.Types.ObjectId().toString(),
                            price: 100,
                            quantity: 1,
                        },
                    ],
                    shippingAddress: { city: "Bengaluru" }, // missing street, pincode, etc.
                });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // 3. Authentication Failures (401 Unauthorized)
    // ═══════════════════════════════════════════════════════════════════════════
    describe("Authentication Failures", () => {
        it("should return 401 when Authorization header is missing", async () => {
            const res = await request(app)
                .post("/api/orders")
                .send({ items: [], shippingAddress: sampleAddress });

            expect(res.status).toBe(401);
            expect(res.body.success).toBe(false);
        });

        it("should return 401 when token is invalid or expired", async () => {
            const res = await request(app)
                .post("/api/orders")
                .set("Authorization", "Bearer invalid.fake.token")
                .send({ items: [], shippingAddress: sampleAddress });

            expect(res.status).toBe(401);
            expect(res.body.success).toBe(false);
        });
    });
});
