/**
 * Test suite for POST /api/cart/items
 *
 * Spec:
 * 1. Adds an item { productId, qty } to the authenticated user's cart.
 * 2. If the product is not in the cart, it appends a new item line.
 * 3. If the product already exists in the cart, it increments its quantity.
 * 4. Validates required fields: productId must be a valid ObjectId; qty must be positive integer.
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

describe("POST /api/cart/items", () => {
    // ═══════════════════════════════════════════════════════════════════════════
    // 1. Happy Path (200 / 201 Created)
    // ═══════════════════════════════════════════════════════════════════════════
    describe("Successful Item Addition", () => {
        it("should successfully add a new product to cart", async () => {
            const { token } = generateAuthToken();
            const productId = new mongoose.Types.ObjectId().toString();

            const res = await request(app)
                .post("/api/cart/items")
                .set("Authorization", `Bearer ${token}`)
                .send({ productId, qty: 2 });

            expect([200, 201]).toContain(res.status);
            expect(res.body.success).toBe(true);

            const cart = res.body.data?.cart || res.body.cart || res.body.data;
            expect(cart).toBeDefined();
            expect(cart.items).toHaveLength(1);
            expect(cart.items[0].productId.toString()).toBe(productId);
            expect(cart.items[0].quantity ?? cart.items[0].qty).toBe(2);
        });

        it("should support adding multiple distinct products to cart", async () => {
            const { token } = generateAuthToken();
            const productA = new mongoose.Types.ObjectId().toString();
            const productB = new mongoose.Types.ObjectId().toString();

            await request(app)
                .post("/api/cart/items")
                .set("Authorization", `Bearer ${token}`)
                .send({ productId: productA, qty: 1 });

            const res = await request(app)
                .post("/api/cart/items")
                .set("Authorization", `Bearer ${token}`)
                .send({ productId: productB, qty: 4 });

            expect([200, 201]).toContain(res.status);
            const cart = res.body.data?.cart || res.body.cart || res.body.data;
            expect(cart.items).toHaveLength(2);
        });

        it("should increment quantity when adding an already existing product", async () => {
            const { token } = generateAuthToken();
            const productId = new mongoose.Types.ObjectId().toString();

            // First add: 2
            await request(app)
                .post("/api/cart/items")
                .set("Authorization", `Bearer ${token}`)
                .send({ productId, qty: 2 });

            // Second add: 3 more
            const res = await request(app)
                .post("/api/cart/items")
                .set("Authorization", `Bearer ${token}`)
                .send({ productId, qty: 3 });

            expect([200, 201]).toContain(res.status);
            const cart = res.body.data?.cart || res.body.cart || res.body.data;
            // Alag row nahi banegi, balki same row update hogi (total 2 + 3 = 5)
            expect(cart.items).toHaveLength(1);
            expect(cart.items[0].quantity ?? cart.items[0].qty).toBe(5);
        });

        it("should accept quantity as either 'qty' or 'quantity' field", async () => {
            const { token } = generateAuthToken();
            const productId = new mongoose.Types.ObjectId().toString();

            const res = await request(app)
                .post("/api/cart/items")
                .set("Authorization", `Bearer ${token}`)
                .send({ productId, quantity: 4 });

            expect([200, 201]).toContain(res.status);
            const cart = res.body.data?.cart || res.body.cart || res.body.data;
            expect(cart.items[0].quantity ?? cart.items[0].qty).toBe(4);
        });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // 2. Input Validations (400 Bad Request)
    // ═══════════════════════════════════════════════════════════════════════════
    describe("Input Validations", () => {
        it("should return 400 when productId is missing", async () => {
            const { token } = generateAuthToken();

            const res = await request(app)
                .post("/api/cart/items")
                .set("Authorization", `Bearer ${token}`)
                .send({ qty: 2 });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.error.message).toMatch(/product.*required|missing/i);
        });

        it("should return 400 when productId format is invalid", async () => {
            const { token } = generateAuthToken();

            const res = await request(app)
                .post("/api/cart/items")
                .set("Authorization", `Bearer ${token}`)
                .send({ productId: "not-a-valid-object-id", qty: 1 });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.error.message).toMatch(/invalid.*id|objectid/i);
        });

        it("should return 400 when quantity is 0", async () => {
            const { token } = generateAuthToken();
            const productId = new mongoose.Types.ObjectId().toString();

            const res = await request(app)
                .post("/api/cart/items")
                .set("Authorization", `Bearer ${token}`)
                .send({ productId, qty: 0 });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.error.message).toMatch(/quantity|qty|greater.*0/i);
        });

        it("should return 400 when quantity is negative", async () => {
            const { token } = generateAuthToken();
            const productId = new mongoose.Types.ObjectId().toString();

            const res = await request(app)
                .post("/api/cart/items")
                .set("Authorization", `Bearer ${token}`)
                .send({ productId, qty: -5 });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });

        it("should return 400 when quantity is non-numeric", async () => {
            const { token } = generateAuthToken();
            const productId = new mongoose.Types.ObjectId().toString();

            const res = await request(app)
                .post("/api/cart/items")
                .set("Authorization", `Bearer ${token}`)
                .send({ productId, qty: "five" });

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
                .post("/api/cart/items")
                .send({ productId: new mongoose.Types.ObjectId().toString(), qty: 1 });

            expect(res.status).toBe(401);
            expect(res.body.success).toBe(false);
        });

        it("should return 401 when token is invalid or expired", async () => {
            const res = await request(app)
                .post("/api/cart/items")
                .set("Authorization", "Bearer invalid.token.payload")
                .send({ productId: new mongoose.Types.ObjectId().toString(), qty: 1 });

            expect(res.status).toBe(401);
            expect(res.body.success).toBe(false);
        });
    });
});
