/**
 * Test suite for GET /api/orders/me
 *
 * Spec:
 * 1. Fetches a paginated list of all orders belonging to the authenticated customer.
 * 2. Returns empty array if customer has not placed any orders yet.
 * 3. Supports pagination via query parameters (limit & skip/page).
 * 4. Customer Isolation: User A only receives their own orders, never orders from User B.
 * 5. Requires valid authentication (Bearer token or cookie).
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

describe("GET /api/orders/me", () => {
    // ═══════════════════════════════════════════════════════════════════════════
    // 1. Happy Path & Listing
    // ═══════════════════════════════════════════════════════════════════════════
    describe("Successful Order Listing", () => {
        it("should return empty list when customer has no orders", async () => {
            const { token } = generateAuthToken();

            const res = await request(app)
                .get("/api/orders/me")
                .set("Authorization", `Bearer ${token}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);

            const orders = res.body.data?.orders || res.body.orders || res.body.data;
            expect(orders).toBeDefined();
            expect(orders).toEqual([]);
        });

        it("should return list of orders belonging to the customer", async () => {
            const { token } = generateAuthToken();

            // 2 orders create karo
            await request(app)
                .post("/api/orders")
                .set("Authorization", `Bearer ${token}`)
                .send({
                    items: [{ productId: new mongoose.Types.ObjectId().toString(), price: 300, quantity: 1 }],
                    shippingAddress: sampleAddress,
                });

            await request(app)
                .post("/api/orders")
                .set("Authorization", `Bearer ${token}`)
                .send({
                    items: [{ productId: new mongoose.Types.ObjectId().toString(), price: 800, quantity: 2 }],
                    shippingAddress: sampleAddress,
                });

            const res = await request(app)
                .get("/api/orders/me")
                .set("Authorization", `Bearer ${token}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);

            const orders = res.body.data?.orders || res.body.orders || res.body.data;
            expect(orders).toHaveLength(2);
        });

        it("should ensure Customer Isolation (User A only sees their own orders)", async () => {
            const { token: userAToken } = generateAuthToken();
            const { token: userBToken } = generateAuthToken();

            // User A creates 1 order
            await request(app)
                .post("/api/orders")
                .set("Authorization", `Bearer ${userAToken}`)
                .send({
                    items: [{ productId: new mongoose.Types.ObjectId().toString(), price: 200, quantity: 1 }],
                    shippingAddress: sampleAddress,
                });

            // User B creates 2 orders
            await request(app)
                .post("/api/orders")
                .set("Authorization", `Bearer ${userBToken}`)
                .send({
                    items: [{ productId: new mongoose.Types.ObjectId().toString(), price: 400, quantity: 1 }],
                    shippingAddress: sampleAddress,
                });
            await request(app)
                .post("/api/orders")
                .set("Authorization", `Bearer ${userBToken}`)
                .send({
                    items: [{ productId: new mongoose.Types.ObjectId().toString(), price: 900, quantity: 1 }],
                    shippingAddress: sampleAddress,
                });

            // User A fetch karega
            const resA = await request(app)
                .get("/api/orders/me")
                .set("Authorization", `Bearer ${userAToken}`);

            const ordersA = resA.body.data?.orders || resA.body.orders || resA.body.data;
            expect(ordersA).toHaveLength(1);

            // User B fetch karega
            const resB = await request(app)
                .get("/api/orders/me")
                .set("Authorization", `Bearer ${userBToken}`);

            const ordersB = resB.body.data?.orders || resB.body.orders || resB.body.data;
            expect(ordersB).toHaveLength(2);
        });

        it("should support pagination with limit query parameter", async () => {
            const { token } = generateAuthToken();

            // 3 orders create karo
            for (let i = 0; i < 3; i++) {
                await request(app)
                    .post("/api/orders")
                    .set("Authorization", `Bearer ${token}`)
                    .send({
                        items: [{ productId: new mongoose.Types.ObjectId().toString(), price: 100 * (i + 1), quantity: 1 }],
                        shippingAddress: sampleAddress,
                    });
            }

            const res = await request(app)
                .get("/api/orders/me?limit=2")
                .set("Authorization", `Bearer ${token}`);

            expect(res.status).toBe(200);
            const orders = res.body.data?.orders || res.body.orders || res.body.data;
            expect(orders).toHaveLength(2);
        });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // 2. Authentication Failures (401 Unauthorized)
    // ═══════════════════════════════════════════════════════════════════════════
    describe("Authentication Failures", () => {
        it("should return 401 when Authorization header is missing", async () => {
            const res = await request(app).get("/api/orders/me");

            expect(res.status).toBe(401);
            expect(res.body.success).toBe(false);
        });

        it("should return 401 when token is invalid or expired", async () => {
            const res = await request(app)
                .get("/api/orders/me")
                .set("Authorization", "Bearer invalid.fake.token");

            expect(res.status).toBe(401);
            expect(res.body.success).toBe(false);
        });
    });
});
