/**
 * TDD test suite for GET /api/products/seller
 *
 * Spec:
 * 1. RBAC: Only authenticated SELLER (or ADMIN) can access this endpoint.
 * 2. Isolation: Returns ONLY the products belonging to the authenticated seller.
 * 3. Returns empty array if the seller has not published any products yet.
 * 4. Rejects unauthenticated requests with 401.
 * 5. Rejects non-seller users (USER role) with 403.
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
        username: role === "SELLER" ? "test_seller" : role === "ADMIN" ? "test_admin" : "test_buyer",
        email: `${role.toLowerCase()}@cartopia.com`,
        roles: role,
    };
    return {
        token: jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" }),
        user: payload,
    };
};

describe("GET /api/products/seller", () => {
    // ═══════════════════════════════════════════════════════════════════════════
    // 1. Happy Path & Seller Isolation (200 OK)
    // ═══════════════════════════════════════════════════════════════════════════
    describe("Successful Seller Products Retrieval", () => {
        it("should return only products belonging to the authenticated seller", async () => {
            const { token: sellerAToken, user: sellerA } = generateAuthToken("SELLER");
            const { user: sellerB } = generateAuthToken("SELLER");

            // Seller A ke 2 products
            await ProductModel.create([
                {
                    title: "Seller A Product 1",
                    description: "First product of seller A",
                    price: { amount: 1200, currency: "INR" },
                    seller: sellerA.id,
                },
                {
                    title: "Seller A Product 2",
                    description: "Second product of seller A",
                    price: { amount: 2400, currency: "INR" },
                    seller: sellerA.id,
                },
            ]);

            // Seller B ka 1 product (yeh result me NAHI aana chahiye)
            await ProductModel.create({
                title: "Seller B Product",
                description: "Product of seller B",
                price: { amount: 5000, currency: "INR" },
                seller: sellerB.id,
            });

            const res = await request(app).get("/api/products/seller").set("Authorization", `Bearer ${sellerAToken}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);

            // Response payload me data.products ya products hona chahiye
            const products = res.body.data?.products || res.body.products;
            expect(Array.isArray(products)).toBe(true);
            expect(products).toHaveLength(2);

            // Verify karo ki dono products Seller A ke hi hain
            products.forEach((p) => {
                expect(p.seller.toString()).toBe(sellerA.id);
            });
        });

        it("should return empty array when seller has no products", async () => {
            const { token: newSellerToken } = generateAuthToken("SELLER");

            const res = await request(app).get("/api/products/seller").set("Authorization", `Bearer ${newSellerToken}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);

            const products = res.body.data?.products || res.body.products;
            expect(Array.isArray(products)).toBe(true);
            expect(products).toHaveLength(0);
        });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // 2. Authentication & RBAC (401 & 403)
    // ═══════════════════════════════════════════════════════════════════════════
    describe("Authentication & RBAC Validation", () => {
        it("should return 401 when Authorization header is missing", async () => {
            const res = await request(app).get("/api/products/seller");

            expect(res.status).toBe(401);
            expect(res.body.success).toBe(false);
        });

        it("should return 401 when token is invalid or forged", async () => {
            const res = await request(app)
                .get("/api/products/seller")
                .set("Authorization", "Bearer invalid.token.value");

            expect(res.status).toBe(401);
            expect(res.body.success).toBe(false);
        });

        it("should return 403 when user has USER role instead of SELLER", async () => {
            const { token: buyerToken } = generateAuthToken("USER");

            const res = await request(app).get("/api/products/seller").set("Authorization", `Bearer ${buyerToken}`);

            expect(res.status).toBe(403);
            expect(res.body.success).toBe(false);
            expect(res.body.error.message).toMatch(/seller|permission|forbidden/i);
        });
    });
});
