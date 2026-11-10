/**
 * TDD test suite for PATCH /api/products/:id
 *
 * Spec:
 * 1. Updates product fields (title, description, price).
 * 2. RBAC & Ownership: Only authenticated SELLER (owner) or ADMIN can update.
 * 3. Returns 403 if another SELLER attempts to update a product they don't own.
 * 4. Returns 400 for invalid ObjectId or invalid field values (e.g. negative price).
 * 5. Returns 404 if product does not exist.
 */

import { describe, it, expect } from "@jest/globals";
import "dotenv/config";
import request from "supertest";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { app } from "../app.js";
import { ProductModel } from "../models/product.model.js";

const JWT_SECRET = process.env.JWT_SECRET || "test_jwt_secret";

// Test helper: JWT token generator
const generateAuthToken = (role = "SELLER", customId = null) => {
    const payload = {
        id: customId || new mongoose.Types.ObjectId().toString(),
        username: role === "SELLER" ? "test_seller" : "test_buyer",
        email: `${role.toLowerCase()}@cartopia.com`,
        roles: role,
    };
    return {
        token: jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" }),
        user: payload,
    };
};

describe("PATCH /api/products/:id", () => {
    // ═══════════════════════════════════════════════════════════════════════════
    // 1. Happy Path (200 OK)
    // ═══════════════════════════════════════════════════════════════════════════
    describe("Successful Product Update", () => {
        it("should allow the seller to update their own product fields", async () => {
            const { token, user: seller } = generateAuthToken("SELLER");

            const initialProduct = await ProductModel.create({
                title: "Original Mechanical Keyboard",
                description: "Original description",
                price: { amount: 3000, currency: "INR" },
                seller: seller.id,
                image: [{ url: "https://ik.imagekit.io/test/orig.png", id: "img_1" }],
            });

            const res = await request(app)
                .patch(`/api/products/${initialProduct._id}`)
                .set("Authorization", `Bearer ${token}`)
                .send({
                    title: "Updated Mechanical Keyboard Pro",
                    description: "Updated description with RGB switches",
                    price: { amount: 4500, currency: "INR" },
                });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);

            // DB me verify karo ki fields update ho gayi hain
            const updatedProduct = await ProductModel.findById(initialProduct._id);
            expect(updatedProduct.title).toBe("Updated Mechanical Keyboard Pro");
            expect(updatedProduct.description).toBe("Updated description with RGB switches");
            expect(updatedProduct.price.amount).toBe(4500);
        });

        it("should allow partial updates (e.g. only update price)", async () => {
            const { token, user: seller } = generateAuthToken("SELLER");

            const product = await ProductModel.create({
                title: "Fixed Title Keyboard",
                description: "Fixed Description",
                price: { amount: 2000, currency: "INR" },
                seller: seller.id,
            });

            const res = await request(app)
                .patch(`/api/products/${product._id}`)
                .set("Authorization", `Bearer ${token}`)
                .send({
                    price: { amount: 2500, currency: "INR" },
                });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);

            const updated = await ProductModel.findById(product._id);
            expect(updated.title).toBe("Fixed Title Keyboard");
            expect(updated.price.amount).toBe(2500);
        });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // 2. Ownership & RBAC (401 & 403)
    // ═══════════════════════════════════════════════════════════════════════════
    describe("Authentication, RBAC & Ownership", () => {
        it("should return 401 when Authorization header is missing", async () => {
            const fakeId = new mongoose.Types.ObjectId();

            const res = await request(app)
                .patch(`/api/products/${fakeId}`)
                .send({ title: "New Title" });

            expect(res.status).toBe(401);
            expect(res.body.success).toBe(false);
        });

        it("should return 401 when token is invalid", async () => {
            const fakeId = new mongoose.Types.ObjectId();

            const res = await request(app)
                .patch(`/api/products/${fakeId}`)
                .set("Authorization", "Bearer invalid_token")
                .send({ title: "New Title" });

            expect(res.status).toBe(401);
            expect(res.body.success).toBe(false);
        });

        it("should return 403 when user has USER role instead of SELLER", async () => {
            const { token: buyerToken } = generateAuthToken("USER");
            const sellerId = new mongoose.Types.ObjectId();

            const product = await ProductModel.create({
                title: "Seller Product",
                price: { amount: 1000, currency: "INR" },
                seller: sellerId,
            });

            const res = await request(app)
                .patch(`/api/products/${product._id}`)
                .set("Authorization", `Bearer ${buyerToken}`)
                .send({ title: "Buyer Trying To Edit" });

            expect(res.status).toBe(403);
            expect(res.body.success).toBe(false);
        });

        it("should return 403 when a SELLER tries to update another SELLER's product", async () => {
            const { user: sellerOwner } = generateAuthToken("SELLER");
            const { token: otherSellerToken } = generateAuthToken("SELLER");

            const product = await ProductModel.create({
                title: "Owner's Product",
                price: { amount: 1999, currency: "INR" },
                seller: sellerOwner.id,
            });

            const res = await request(app)
                .patch(`/api/products/${product._id}`)
                .set("Authorization", `Bearer ${otherSellerToken}`)
                .send({ title: "Hacked Product" });

            expect(res.status).toBe(403);
            expect(res.body.success).toBe(false);
            expect(res.body.error.message).toMatch(/own|permission|forbidden/i);

            // DB me value change nahi honi chahiye
            const untouched = await ProductModel.findById(product._id);
            expect(untouched.title).toBe("Owner's Product");
        });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // 3. Validations & Not Found (400 & 404)
    // ═══════════════════════════════════════════════════════════════════════════
    describe("Input & Existence Validations", () => {
        it("should return 400 when product ID format is invalid", async () => {
            const { token } = generateAuthToken("SELLER");

            const res = await request(app)
                .patch("/api/products/invalid-id-format")
                .set("Authorization", `Bearer ${token}`)
                .send({ title: "Updated" });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });

        it("should return 404 when product does not exist", async () => {
            const { token } = generateAuthToken("SELLER");
            const nonExistentId = new mongoose.Types.ObjectId();

            const res = await request(app)
                .patch(`/api/products/${nonExistentId}`)
                .set("Authorization", `Bearer ${token}`)
                .send({ title: "Updated" });

            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
            expect(res.body.error.message).toMatch(/not found/i);
        });

        it("should return 400 when updated price amount is negative", async () => {
            const { token, user: seller } = generateAuthToken("SELLER");

            const product = await ProductModel.create({
                title: "Sample Item",
                price: { amount: 500, currency: "INR" },
                seller: seller.id,
            });

            const res = await request(app)
                .patch(`/api/products/${product._id}`)
                .set("Authorization", `Bearer ${token}`)
                .send({
                    price: { amount: -100, currency: "INR" },
                });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
    });
});

