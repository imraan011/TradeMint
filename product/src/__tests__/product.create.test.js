/**
 * TDD test suite for POST /api/products
 *
 * Spec:
 * 1. Creates a new product with multipart/form-data (Multer + ImageKit).
 * 2. RBAC: Only authenticated users with role "SELLER" can create products.
 * 3. Validates required fields: title, price amount, image file.
 * 4. Saves seller ID from JWT token payload into product document.
 */

import { describe, it, expect } from "@jest/globals";
import "dotenv/config";
import request from "supertest";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { app } from "../app.js";
import { ProductModel } from "../models/product.model.js";

const JWT_SECRET = process.env.JWT_SECRET || "test_jwt_secret";

// Test helper: JWT token generate karta hai
const generateAuthToken = (role = "SELLER") => {
    const payload = {
        id: new mongoose.Types.ObjectId().toString(),
        username: role === "SELLER" ? "test_seller" : "test_buyer",
        email: `${role.toLowerCase()}@cartopia.com`,
        roles: role,
    };
    return {
        token: jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" }),
        user: payload,
    };
};

describe("POST /api/products", () => {
    // ═══════════════════════════════════════════════════════════════════════════
    // 1. Happy Path (201 Created)
    // ═══════════════════════════════════════════════════════════════════════════
    describe("Successful Product Creation", () => {
        it("should create product with valid seller token and image file", async () => {
            const { token, user } = generateAuthToken("SELLER");

            // Mock image buffer (1x1 pixel PNG)
            const sampleImage = Buffer.from(
                "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
                "base64",
            );

            const res = await request(app)
                .post("/api/products")
                .set("Authorization", `Bearer ${token}`)
                .field("title", "Noise Cancelling Headphones")
                .field("description", "Wireless over-ear premium headphones")
                .field("price[amount]", 4999)
                .field("price[currency]", "INR")
                .attach("images", sampleImage, "headphones.png");

            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);

            const { product } = res.body.data;
            expect(product).toBeDefined();
            expect(product._id).toBeDefined();
            expect(product.title).toBe("Noise Cancelling Headphones");
            expect(product.description).toBe("Wireless over-ear premium headphones");
            expect(product.price.amount).toBe(4999);
            expect(product.price.currency).toBe("INR");
            expect(product.seller.toString()).toBe(user.id);

            // Image array check
            expect(Array.isArray(product.image)).toBe(true);
            expect(product.image.length).toBeGreaterThanOrEqual(1);

            // DB me verify karo
            const savedProduct = await ProductModel.findById(product._id);
            expect(savedProduct).not.toBeNull();
            expect(savedProduct.title).toBe("Noise Cancelling Headphones");
        });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // 2. Authentication & Authorization (401 & 403)
    // ═══════════════════════════════════════════════════════════════════════════
    describe("Auth & Role Validation", () => {
        it("should return 401 when Authorization header is missing", async () => {
            const res = await request(app)
                .post("/api/products")
                .field("title", "Sample Product")
                .field("price[amount]", 999);

            expect(res.status).toBe(401);
            expect(res.body.success).toBe(false);
            expect(res.body.error.message).toBeDefined();
        });

        it("should return 401 when token is invalid or forged", async () => {
            const res = await request(app)
                .post("/api/products")
                .set("Authorization", "Bearer invalid.token.value")
                .field("title", "Sample Product")
                .field("price[amount]", 999);

            expect(res.status).toBe(401);
            expect(res.body.success).toBe(false);
        });

        it("should return 403 when user is not a SELLER (e.g. role is USER)", async () => {
            const { token } = generateAuthToken("USER");

            const res = await request(app)
                .post("/api/products")
                .set("Authorization", `Bearer ${token}`)
                .field("title", "Unauthorized Product")
                .field("price[amount]", 1999);

            expect(res.status).toBe(403);
            expect(res.body.success).toBe(false);
            expect(res.body.error.message).toMatch(/seller/i);
        });
    });
    // ═══════════════════════════════════════════════════════════════════════════
    // 3. Validation Failures (400 Bad Request)
    // ═══════════════════════════════════════════════════════════════════════════
    describe("Field Validations", () => {
        it("should return 400 when title is missing", async () => {
            const { token } = generateAuthToken("SELLER");

            const res = await request(app)
                .post("/api/products")
                .set("Authorization", `Bearer ${token}`)
                .field("price[amount]", 999);

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.error.message).toBeDefined();
        });

        it("should return 400 when price amount is missing", async () => {
            const { token } = generateAuthToken("SELLER");

            const res = await request(app)
                .post("/api/products")
                .set("Authorization", `Bearer ${token}`)
                .field("title", "Product without price");

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.error.message).toBeDefined();
        });

        it("should return 400 when price amount is non-numeric or negative", async () => {
            const { token } = generateAuthToken("SELLER");

            const res = await request(app)
                .post("/api/products")
                .set("Authorization", `Bearer ${token}`)
                .field("title", "Product with negative price")
                .field("price[amount]", -50);

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.error.message).toBeDefined();
        });

        it("should return 400 when image file is missing", async () => {
            const { token } = generateAuthToken("SELLER");

            const res = await request(app)
                .post("/api/products")
                .set("Authorization", `Bearer ${token}`)
                .field("title", "Product without image")
                .field("price[amount]", 1499);

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.error.message).toBeDefined();
        });
    });
});

