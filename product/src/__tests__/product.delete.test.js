/**
 * TDD test suite for DELETE /api/products/:id
 *
 * Spec:
 * 1. Allows authenticated SELLER (owner) to delete their product.
 * 2. Allows ADMIN to delete any product (moderation).
 * 3. Prevents unauthorized users (USER role) -> 403.
 * 4. Prevents cross-seller deletion (Seller A cannot delete Seller B's product) -> 403.
 * 5. Returns 400 for malformed ObjectId.
 * 6. Returns 404 if product does not exist.
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
const generateAuthToken = (role = "SELLER", customId = null) => {
    const payload = {
        id: customId || new mongoose.Types.ObjectId().toString(),
        username:
            role === "SELLER"
                ? "test_seller"
                : role === "ADMIN"
                  ? "test_admin"
                  : "test_buyer",
        email: `${role.toLowerCase()}@cartopia.com`,
        roles: role,
    };
    return {
        token: jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" }),
        user: payload,
    };
};

describe("DELETE /api/products/:id", () => {
    // ═══════════════════════════════════════════════════════════════════════════
    // 1. Happy Path (200 OK)
    // ═══════════════════════════════════════════════════════════════════════════
    describe("Successful Product Deletion", () => {
        it("should allow the seller to delete their own product", async () => {
            const { token, user: seller } = generateAuthToken("SELLER");

            const product = await ProductModel.create({
                title: "Product to Delete",
                description: "Will be removed soon",
                price: { amount: 1500, currency: "INR" },
                seller: seller.id,
            });

            const res = await request(app)
                .delete(`/api/products/${product._id}`)
                .set("Authorization", `Bearer ${token}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);

            // DB me verify karo ki product delete ho chuka hai
            const deleted = await ProductModel.findById(product._id);
            expect(deleted).toBeNull();
        });

        it("should allow an ADMIN to delete any product", async () => {
            const { token: adminToken } = generateAuthToken("ADMIN");
            const sellerId = new mongoose.Types.ObjectId();

            const product = await ProductModel.create({
                title: "Inappropriate Product",
                description: "Flagged by moderator",
                price: { amount: 999, currency: "INR" },
                seller: sellerId,
            });

            const res = await request(app)
                .delete(`/api/products/${product._id}`)
                .set("Authorization", `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);

            const deleted = await ProductModel.findById(product._id);
            expect(deleted).toBeNull();
        });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // 2. Authentication, RBAC & Ownership Security (401 & 403)
    // ═══════════════════════════════════════════════════════════════════════════
    describe("Authentication, RBAC & Ownership", () => {
        it("should return 401 when Authorization header is missing", async () => {
            const fakeId = new mongoose.Types.ObjectId();

            const res = await request(app).delete(`/api/products/${fakeId}`);

            expect(res.status).toBe(401);
            expect(res.body.success).toBe(false);
        });

        it("should return 401 when token is invalid or forged", async () => {
            const fakeId = new mongoose.Types.ObjectId();

            const res = await request(app)
                .delete(`/api/products/${fakeId}`)
                .set("Authorization", "Bearer invalid.token.value");

            expect(res.status).toBe(401);
            expect(res.body.success).toBe(false);
        });

        it("should return 403 when user has USER role instead of SELLER/ADMIN", async () => {
            const { token: buyerToken } = generateAuthToken("USER");
            const sellerId = new mongoose.Types.ObjectId();

            const product = await ProductModel.create({
                title: "Buyer Trying To Delete",
                price: { amount: 2000, currency: "INR" },
                seller: sellerId,
            });

            const res = await request(app)
                .delete(`/api/products/${product._id}`)
                .set("Authorization", `Bearer ${buyerToken}`);

            expect(res.status).toBe(403);
            expect(res.body.success).toBe(false);

            // DB me product surakshit rehna chahiye
            const untouched = await ProductModel.findById(product._id);
            expect(untouched).not.toBeNull();
        });

        it("should return 403 when a SELLER tries to delete another SELLER's product", async () => {
            const { user: sellerOwner } = generateAuthToken("SELLER");
            const { token: attackerSellerToken } = generateAuthToken("SELLER");

            const product = await ProductModel.create({
                title: "Owner's Precious Product",
                price: { amount: 5000, currency: "INR" },
                seller: sellerOwner.id,
            });

            const res = await request(app)
                .delete(`/api/products/${product._id}`)
                .set("Authorization", `Bearer ${attackerSellerToken}`);

            expect(res.status).toBe(403);
            expect(res.body.success).toBe(false);
            expect(res.body.error.message).toMatch(/own|permission|forbidden|authorized/i);

            // DB me product delete nahi hona chahiye
            const untouched = await ProductModel.findById(product._id);
            expect(untouched).not.toBeNull();
        });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // 3. Validations & Existence (400 & 404)
    // ═══════════════════════════════════════════════════════════════════════════
    describe("Input Validation & Existence", () => {
        it("should return 400 when product ID format is invalid", async () => {
            const { token } = generateAuthToken("SELLER");

            const res = await request(app)
                .delete("/api/products/invalid-id-format")
                .set("Authorization", `Bearer ${token}`);

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.error.message).toMatch(/invalid.*id/i);
        });

        it("should return 404 when product does not exist in DB", async () => {
            const { token } = generateAuthToken("SELLER");
            const nonExistentId = new mongoose.Types.ObjectId();

            const res = await request(app)
                .delete(`/api/products/${nonExistentId}`)
                .set("Authorization", `Bearer ${token}`);

            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
            expect(res.body.error.message).toMatch(/not found/i);
        });
    });
});

