/**
 * Test suite for GET /api/orders/me
 *
 * Spec:
 * 1. Fetches a paginated list of all orders belonging to the authenticated customer.
 * 2. Returns empty array if customer has not placed any orders yet.
 * 3. Supports pagination via query parameters (limit & page).
 * 4. Customer Isolation: User A only receives their own orders, never orders from User B.
 * 5. Requires valid authentication (Bearer token).
 *
 * Pattern: OrderModel.create() se DB seed karo — no POST /api/orders needed here.
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

/** DB seed helper — ek order directly DB mein daal deta hai */
const seedOrder = (userId, overrides = {}) =>
    OrderModel.create({
        user: userId,
        shippingAddress: sampleAddress,
        items: [
            {
                productId: new mongoose.Types.ObjectId(),
                quantity: 1,
                price: { amount: 500, currency: "INR" },
            },
        ],
        status: "pending",
        totalAmount: 640,
        tax: 90,
        shippingCharges: 50,
        ...overrides,
    });

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

            const orders = res.body.data?.orders ?? res.body.orders ?? res.body.data;
            expect(orders).toEqual([]);
        });

        it("should return list of orders belonging to the customer", async () => {
            const { token, user } = generateAuthToken();

            await seedOrder(user.id);
            await seedOrder(user.id);

            const res = await request(app)
                .get("/api/orders/me")
                .set("Authorization", `Bearer ${token}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);

            const orders = res.body.data?.orders ?? res.body.orders ?? res.body.data;
            expect(orders).toHaveLength(2);
        });

        it("should ensure Customer Isolation (User A only sees their own orders)", async () => {
            const { token: userAToken, user: userA } = generateAuthToken();
            const { token: userBToken, user: userB } = generateAuthToken();

            // User A ka 1 order
            await seedOrder(userA.id);

            // User B ke 2 orders
            await seedOrder(userB.id);
            await seedOrder(userB.id);

            const resA = await request(app)
                .get("/api/orders/me")
                .set("Authorization", `Bearer ${userAToken}`);

            const ordersA = resA.body.data?.orders ?? resA.body.orders ?? resA.body.data;
            expect(ordersA).toHaveLength(1);

            const resB = await request(app)
                .get("/api/orders/me")
                .set("Authorization", `Bearer ${userBToken}`);

            const ordersB = resB.body.data?.orders ?? resB.body.orders ?? resB.body.data;
            expect(ordersB).toHaveLength(2);
        });

        it("should support pagination with limit query parameter", async () => {
            const { token, user } = generateAuthToken();

            // 3 orders seed karo
            await seedOrder(user.id);
            await seedOrder(user.id);
            await seedOrder(user.id);

            const res = await request(app)
                .get("/api/orders/me?limit=2")
                .set("Authorization", `Bearer ${token}`);

            expect(res.status).toBe(200);
            const orders = res.body.data?.orders ?? res.body.orders ?? res.body.data;
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
