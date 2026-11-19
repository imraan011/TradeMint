/**
 * Test suite for POST /api/orders
 *
 * Architecture Spec:
 * 1. Creates an order securely by fetching the user's cart from Cart Service (Prevents Client-Side Tampering).
 * 2. Fetches authoritative prices from Product Service.
 * 3. Client ONLY sends { shippingAddress }. No items/prices accepted from client.
 * 4. Computes taxes and shipping charges, sets totalAmount.
 * 5. Sets initial order status to "pending".
 * 6. Returns 400 if user's cart is empty.
 * 7. Returns 400 if shipping address is missing or incomplete.
 * 8. Requires valid authentication (Bearer token or cookie).
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import "dotenv/config";
import request from "supertest";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import axios from "axios";
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
    const mockProductId = new mongoose.Types.ObjectId().toString();

    beforeEach(() => {
        // Mock external microservices (Cart Service & Product Service)
        jest.spyOn(axios, "get").mockImplementation((url) => {
            // Cart Service mock
            if (url.includes(":3002/api/cart")) {
                return Promise.resolve({
                    data: {
                        cart: {
                            items: [
                                {
                                    productId: mockProductId,
                                    quantity: 2,
                                },
                            ],
                        },
                    },
                });
            }

            // Product Service mock
            if (url.includes(":3001/api/products")) {
                return Promise.resolve({
                    data: {
                        productData: {
                            _id: mockProductId,
                            title: "Wireless Mouse",
                            price: {
                                amount: 500,
                                currency: "INR",
                            },
                            stock: 10,
                        },
                    },
                });
            }

            return Promise.reject(new Error(`Unhandled URL in test mock: ${url}`));
        });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // 1. Happy Path & Order Creation (Secure from Cart)
    // ═══════════════════════════════════════════════════════════════════════════
    describe("Successful Order Creation", () => {
        it("should successfully create an order from user's server cart with status=pending", async () => {
            const { token } = generateAuthToken();

            const res = await request(app)
                .post("/api/orders")
                .set("Authorization", `Bearer ${token}`)
                .send({
                    shippingAddress: sampleAddress,
                });

            expect([200, 201]).toContain(res.status);
            expect(res.body.success).toBe(true);

            const order = res.body.data?.order || res.body.order || res.body.data;
            expect(order).toBeDefined();
            expect(order.status).toBe("pending");
            expect(order.items).toHaveLength(1);
            expect(order.items[0].productId.toString()).toBe(mockProductId);
            expect(order.items[0].quantity).toBe(2);
            expect(order.items[0].price.amount).toBe(500);
        });

        it("should compute taxes and shipping charges in order totals", async () => {
            const { token } = generateAuthToken();

            const res = await request(app)
                .post("/api/orders")
                .set("Authorization", `Bearer ${token}`)
                .send({
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
        it("should return 400 when user cart is empty", async () => {
            const { token } = generateAuthToken();

            // Mock empty cart
            jest.spyOn(axios, "get").mockImplementationOnce(() =>
                Promise.resolve({
                    data: {
                        cart: {
                            items: [],
                        },
                    },
                }),
            );

            const res = await request(app)
                .post("/api/orders")
                .set("Authorization", `Bearer ${token}`)
                .send({
                    shippingAddress: sampleAddress,
                });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.error.message).toMatch(/empty|cart/i);
        });

        it("should return 400 when shipping address is missing", async () => {
            const { token } = generateAuthToken();

            const res = await request(app)
                .post("/api/orders")
                .set("Authorization", `Bearer ${token}`)
                .send({});

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
                .send({ shippingAddress: sampleAddress });

            expect(res.status).toBe(401);
            expect(res.body.success).toBe(false);
        });

        it("should return 401 when token is invalid or expired", async () => {
            const res = await request(app)
                .post("/api/orders")
                .set("Authorization", "Bearer invalid.fake.token")
                .send({ shippingAddress: sampleAddress });

            expect(res.status).toBe(401);
            expect(res.body.success).toBe(false);
        });
    });
});
