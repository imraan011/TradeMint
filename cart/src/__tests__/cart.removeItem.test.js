/**
 * Test suite for DELETE /api/cart/items/:productId
 *
 * Spec:
 * 1. Removes a specific product line from the authenticated user's cart.
 * 2. Recalculates cart total after removal.
 * 3. Returns 404 if the item is not found in the cart.
 * 4. Returns 400 if the productId is an invalid ObjectId format.
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

describe("DELETE /api/cart/items/:productId", () => {
    // ═══════════════════════════════════════════════════════════════════════════
    // 1. Happy Path & Item Removal
    // ═══════════════════════════════════════════════════════════════════════════
    describe("Successful Item Removal", () => {
        it("should successfully remove a specific product line from cart", async () => {
            const { token } = generateAuthToken();
            const productA = new mongoose.Types.ObjectId().toString();
            const productB = new mongoose.Types.ObjectId().toString();

            // 2 items add karo
            await request(app)
                .post("/api/cart/items")
                .set("Authorization", `Bearer ${token}`)
                .send({ productId: productA, qty: 1 });

            await request(app)
                .post("/api/cart/items")
                .set("Authorization", `Bearer ${token}`)
                .send({ productId: productB, qty: 3 });

            // productA ko delete karo
            const res = await request(app)
                .delete(`/api/cart/items/${productA}`)
                .set("Authorization", `Bearer ${token}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);

            const cart = res.body.data?.cart || res.body.cart || res.body.data;
            expect(cart.items).toHaveLength(1);
            expect(cart.items[0].productId.toString()).toBe(productB);
        });

        it("should leave the cart with empty array when removing the only item", async () => {
            const { token } = generateAuthToken();
            const product = new mongoose.Types.ObjectId().toString();

            await request(app)
                .post("/api/cart/items")
                .set("Authorization", `Bearer ${token}`)
                .send({ productId: product, qty: 2 });

            const res = await request(app)
                .delete(`/api/cart/items/${product}`)
                .set("Authorization", `Bearer ${token}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);

            const cart = res.body.data?.cart || res.body.cart || res.body.data;
            expect(cart.items).toHaveLength(0);
            expect(cart.totalAmount ?? cart.total ?? 0).toBe(0);
        });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // 2. Not Found & Validations (404 & 400)
    // ═══════════════════════════════════════════════════════════════════════════
    describe("Not Found & Validations", () => {
        it("should return 404 when trying to delete an item not in user's cart", async () => {
            const { token } = generateAuthToken();
            const randomProductId = new mongoose.Types.ObjectId().toString();

            const res = await request(app)
                .delete(`/api/cart/items/${randomProductId}`)
                .set("Authorization", `Bearer ${token}`);

            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
            expect(res.body.error.message).toMatch(/not found|item.*cart/i);
        });

        it("should return 400 when productId format is invalid", async () => {
            const { token } = generateAuthToken();

            const res = await request(app)
                .delete("/api/cart/items/invalid-object-id")
                .set("Authorization", `Bearer ${token}`);

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

            const res = await request(app).delete(`/api/cart/items/${productId}`);

            expect(res.status).toBe(401);
            expect(res.body.success).toBe(false);
        });

        it("should return 401 when token is invalid or forged", async () => {
            const productId = new mongoose.Types.ObjectId().toString();

            const res = await request(app)
                .delete(`/api/cart/items/${productId}`)
                .set("Authorization", "Bearer invalid.token");

            expect(res.status).toBe(401);
            expect(res.body.success).toBe(false);
        });
    });
});
