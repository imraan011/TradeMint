/**
 * Test suite for DELETE /api/cart (Clear Cart)
 *
 * Spec:
 * 1. Empties the entire shopping cart for the authenticated user.
 * 2. Sets cart items array to [] and total amount to 0.
 * 3. Clearing an already empty cart succeeds idempotently (200 OK).
 * 4. User Isolation: Clearing User A's cart does not affect User B's cart items.
 * 5. Requires valid authentication (Bearer token).
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

describe("DELETE /api/cart", () => {
    // ═══════════════════════════════════════════════════════════════════════════
    // 1. Happy Path & Cart Reset
    // ═══════════════════════════════════════════════════════════════════════════
    describe("Successful Cart Clear", () => {
        it("should remove all items from the cart and reset total to 0", async () => {
            const { token } = generateAuthToken();
            const product1 = new mongoose.Types.ObjectId().toString();
            const product2 = new mongoose.Types.ObjectId().toString();

            // 2 items add karo
            await request(app)
                .post("/api/cart/items")
                .set("Authorization", `Bearer ${token}`)
                .send({ productId: product1, qty: 2 });

            await request(app)
                .post("/api/cart/items")
                .set("Authorization", `Bearer ${token}`)
                .send({ productId: product2, qty: 5 });

            // Cart clear karo
            const res = await request(app)
                .delete("/api/cart")
                .set("Authorization", `Bearer ${token}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);

            const cart = res.body.data?.cart || res.body.cart || res.body.data;
            expect(cart.items).toEqual([]);
            expect(cart.totalAmount ?? cart.total ?? 0).toBe(0);

            // GET request se dobara verify karo
            const checkRes = await request(app)
                .get("/api/cart")
                .set("Authorization", `Bearer ${token}`);

            const checkCart = checkRes.body.data?.cart || checkRes.body.cart || checkRes.body.data;
            expect(checkCart.items).toEqual([]);
        });

        it("should be idempotent when clearing an already empty cart", async () => {
            const { token } = generateAuthToken();

            const res = await request(app)
                .delete("/api/cart")
                .set("Authorization", `Bearer ${token}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);

            const cart = res.body.data?.cart || res.body.cart || res.body.data;
            expect(cart.items).toEqual([]);
        });

        it("should only clear User A's cart without touching User B's cart", async () => {
            const { token: userAToken } = generateAuthToken();
            const { token: userBToken } = generateAuthToken();
            const productB = new mongoose.Types.ObjectId().toString();

            // User B apne cart me item add karega
            await request(app)
                .post("/api/cart/items")
                .set("Authorization", `Bearer ${userBToken}`)
                .send({ productId: productB, qty: 4 });

            // User A apna cart clear karega
            const resA = await request(app)
                .delete("/api/cart")
                .set("Authorization", `Bearer ${userAToken}`);

            expect(resA.status).toBe(200);

            // User B ka cart abhi bhi intact hona chahiye
            const resB = await request(app)
                .get("/api/cart")
                .set("Authorization", `Bearer ${userBToken}`);

            const cartB = resB.body.data?.cart || resB.body.cart || resB.body.data;
            expect(cartB.items).toHaveLength(1);
            expect(cartB.items[0].quantity ?? cartB.items[0].qty).toBe(4);
        });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // 2. Authentication Failures (401)
    // ═══════════════════════════════════════════════════════════════════════════
    describe("Authentication Failures", () => {
        it("should return 401 when Authorization header is missing", async () => {
            const res = await request(app).delete("/api/cart");

            expect(res.status).toBe(401);
            expect(res.body.success).toBe(false);
        });

        it("should return 401 when token is invalid or forged", async () => {
            const res = await request(app)
                .delete("/api/cart")
                .set("Authorization", "Bearer invalid.fake.token");

            expect(res.status).toBe(401);
            expect(res.body.success).toBe(false);
        });
    });
});
