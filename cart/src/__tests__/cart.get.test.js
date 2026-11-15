/**
 * Test suite for GET /api/cart
 *
 * Spec:
 * 1. Fetches the current authenticated user's shopping cart.
 * 2. Returns empty cart ({ items: [], total: 0 }) if user has not added items yet.
 * 3. Returns populated cart with items, quantities, and totals.
 * 4. User Isolation: Ensures User A only receives their own cart, never User B's cart.
 * 5. Requires valid authentication (Bearer token or cookie). Rejects with 401 otherwise.
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

describe("GET /api/cart", () => {
    // ═══════════════════════════════════════════════════════════════════════════
    // 1. Happy Path & Cart Retrieval
    // ═══════════════════════════════════════════════════════════════════════════
    describe("Successful Cart Retrieval", () => {
        it("should return empty cart with 0 total when user has no items", async () => {
            const { token } = generateAuthToken();

            const res = await request(app)
                .get("/api/cart")
                .set("Authorization", `Bearer ${token}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);

            const cart = res.body.data?.cart || res.body.cart || res.body.data;
            expect(cart).toBeDefined();
            expect(cart.items).toEqual([]);
            expect(cart.totalAmount ?? cart.total ?? 0).toBe(0);
        });

        it("should return cart with items and total when items have been added", async () => {
            const { token } = generateAuthToken();
            const productId = new mongoose.Types.ObjectId().toString();

            // Item add karo
            await request(app)
                .post("/api/cart/items")
                .set("Authorization", `Bearer ${token}`)
                .send({ productId, qty: 2 });

            const res = await request(app)
                .get("/api/cart")
                .set("Authorization", `Bearer ${token}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);

            const cart = res.body.data?.cart || res.body.cart || res.body.data;
            expect(cart.items).toHaveLength(1);
            expect(cart.items[0].productId.toString()).toBe(productId);
            expect(cart.items[0].quantity ?? cart.items[0].qty).toBe(2);
        });

        it("should ensure User A cannot see User B's cart (User Isolation)", async () => {
            const { token: tokenUserA } = generateAuthToken();
            const { token: tokenUserB } = generateAuthToken();
            const productA = new mongoose.Types.ObjectId().toString();

            // User A cart me item add karega
            await request(app)
                .post("/api/cart/items")
                .set("Authorization", `Bearer ${tokenUserA}`)
                .send({ productId: productA, qty: 3 });

            // User B apna cart fetch karega — User B ka cart empty hona chahiye
            const resUserB = await request(app)
                .get("/api/cart")
                .set("Authorization", `Bearer ${tokenUserB}`);

            expect(resUserB.status).toBe(200);
            const cartB = resUserB.body.data?.cart || resUserB.body.cart || resUserB.body.data;
            expect(cartB.items).toHaveLength(0);

            // User A apna cart fetch karega — User A ke cart me 1 item hona chahiye
            const resUserA = await request(app)
                .get("/api/cart")
                .set("Authorization", `Bearer ${tokenUserA}`);

            const cartA = resUserA.body.data?.cart || resUserA.body.cart || resUserA.body.data;
            expect(cartA.items).toHaveLength(1);
        });

        it("should authenticate via cookie if token is passed in cookies", async () => {
            const { token } = generateAuthToken();

            const res = await request(app)
                .get("/api/cart")
                .set("Cookie", [`token=${token}`]);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // 2. Authentication Failures (401)
    // ═══════════════════════════════════════════════════════════════════════════
    describe("Authentication Failures", () => {
        it("should return 401 when Authorization header and cookies are missing", async () => {
            const res = await request(app).get("/api/cart");

            expect(res.status).toBe(401);
            expect(res.body.success).toBe(false);
            expect(res.body.error.message).toBeDefined();
        });

        it("should return 401 when token is invalid or forged", async () => {
            const res = await request(app)
                .get("/api/cart")
                .set("Authorization", "Bearer invalid.jwt.token");

            expect(res.status).toBe(401);
            expect(res.body.success).toBe(false);
        });

        it("should return 401 when Bearer prefix is missing", async () => {
            const { token } = generateAuthToken();

            const res = await request(app)
                .get("/api/cart")
                .set("Authorization", token);

            expect(res.status).toBe(401);
            expect(res.body.success).toBe(false);
        });
    });
});
