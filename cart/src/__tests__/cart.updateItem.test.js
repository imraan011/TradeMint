/**
 * Test suite for PATCH /api/cart/items/:productId
 *
 * Spec:
 * 1. Updates quantity for an existing item in the authenticated user's cart.
 * 2. If updated quantity <= 0, the item is automatically removed from the cart.
 * 3. Returns recalculated cart totals.
 * 4. Returns 404 if the product does not exist in the user's cart.
 * 5. Returns 400 for invalid productId format.
 * 6. Requires valid authentication (Bearer token).
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

describe("PATCH /api/cart/items/:productId", () => {
    // ═══════════════════════════════════════════════════════════════════════════
    // 1. Happy Path & Quantity Adjustments
    // ═══════════════════════════════════════════════════════════════════════════
    describe("Successful Quantity Updates", () => {
        it("should successfully increase the quantity of an existing item", async () => {
            const { token } = generateAuthToken();
            const productId = new mongoose.Types.ObjectId().toString();

            // Pehle 2 add karo
            await request(app)
                .post("/api/cart/items")
                .set("Authorization", `Bearer ${token}`)
                .send({ productId, qty: 2 });

            // Quantity update karke 6 karo
            const res = await request(app)
                .patch(`/api/cart/items/${productId}`)
                .set("Authorization", `Bearer ${token}`)
                .send({ qty: 6 });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);

            const cart = res.body.data?.cart || res.body.cart || res.body.data;
            expect(cart.items).toHaveLength(1);
            expect(cart.items[0].quantity ?? cart.items[0].qty).toBe(6);
        });

        it("should successfully decrease the quantity of an existing item", async () => {
            const { token } = generateAuthToken();
            const productId = new mongoose.Types.ObjectId().toString();

            // Pehle 5 add karo
            await request(app)
                .post("/api/cart/items")
                .set("Authorization", `Bearer ${token}`)
                .send({ productId, qty: 5 });

            // Quantity ghata kar 1 karo
            const res = await request(app)
                .patch(`/api/cart/items/${productId}`)
                .set("Authorization", `Bearer ${token}`)
                .send({ qty: 1 });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);

            const cart = res.body.data?.cart || res.body.cart || res.body.data;
            expect(cart.items[0].quantity ?? cart.items[0].qty).toBe(1);
        });

        it("should automatically remove item from cart if updated quantity is 0", async () => {
            const { token } = generateAuthToken();
            const productId = new mongoose.Types.ObjectId().toString();

            await request(app)
                .post("/api/cart/items")
                .set("Authorization", `Bearer ${token}`)
                .send({ productId, qty: 3 });

            // Qty 0 bhejo — item cart se remove ho jana chahiye
            const res = await request(app)
                .patch(`/api/cart/items/${productId}`)
                .set("Authorization", `Bearer ${token}`)
                .send({ qty: 0 });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);

            const cart = res.body.data?.cart || res.body.cart || res.body.data;
            expect(cart.items).toHaveLength(0);
        });

        it("should automatically remove item from cart if updated quantity is negative", async () => {
            const { token } = generateAuthToken();
            const productId = new mongoose.Types.ObjectId().toString();

            await request(app)
                .post("/api/cart/items")
                .set("Authorization", `Bearer ${token}`)
                .send({ productId, qty: 2 });

            const res = await request(app)
                .patch(`/api/cart/items/${productId}`)
                .set("Authorization", `Bearer ${token}`)
                .send({ qty: -1 });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);

            const cart = res.body.data?.cart || res.body.cart || res.body.data;
            expect(cart.items).toHaveLength(0);
        });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // 2. Not Found & Validations (404 & 400)
    // ═══════════════════════════════════════════════════════════════════════════
    describe("Not Found & Validations", () => {
        it("should return 404 when product is not in the cart", async () => {
            const { token } = generateAuthToken();
            const nonExistentProductId = new mongoose.Types.ObjectId().toString();

            const res = await request(app)
                .patch(`/api/cart/items/${nonExistentProductId}`)
                .set("Authorization", `Bearer ${token}`)
                .send({ qty: 3 });

            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
            expect(res.body.error.message).toMatch(/not found|item.*cart/i);
        });

        it("should return 400 when productId format is invalid", async () => {
            const { token } = generateAuthToken();

            const res = await request(app)
                .patch("/api/cart/items/invalid-id-format")
                .set("Authorization", `Bearer ${token}`)
                .send({ qty: 2 });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.error.message).toMatch(/invalid.*id/i);
        });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // 3. Authentication Failures (401)
    // ═══════════════════════════════════════════════════════════════════════════
    describe("Authentication Failures", () => {
        it("should return 401 when Authorization header is missing", async () => {
            const productId = new mongoose.Types.ObjectId().toString();

            const res = await request(app)
                .patch(`/api/cart/items/${productId}`)
                .send({ qty: 2 });

            expect(res.status).toBe(401);
            expect(res.body.success).toBe(false);
        });

        it("should return 401 when token is invalid or forged", async () => {
            const productId = new mongoose.Types.ObjectId().toString();

            const res = await request(app)
                .patch(`/api/cart/items/${productId}`)
                .set("Authorization", "Bearer invalid.token.test")
                .send({ qty: 2 });

            expect(res.status).toBe(401);
            expect(res.body.success).toBe(false);
        });
    });
});
