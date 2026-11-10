/**
 * Test suite for GET /api/products
 *
 * Tests:
 * 1. Fetching products list (empty list vs populated list)
 * 2. Search filtering via `q` (text search on title/description)
 * 3. Price range filtering via `minprice` and `maxprice`
 * 4. Pagination via `skip` and `limit`
 */

import { describe, it, expect, beforeAll } from "@jest/globals";
import "dotenv/config";
import request from "supertest";
import mongoose from "mongoose";
import { app } from "../app.js";
import { ProductModel } from "../models/product.model.js";

describe("GET /api/products", () => {
    const sellerId = new mongoose.Types.ObjectId();

    beforeAll(async () => {
        // Text index initialize karo taaki $text search tests me reliably chale
        await ProductModel.syncIndexes();
    });

    // Helper: test products create karta hai
    const seedProducts = async () => {
        return await ProductModel.create([
            {
                title: "Wireless Mechanical Keyboard",
                description: "RGB backlit mechanical keyboard with blue switches",
                price: { amount: 3500, currency: "INR" },
                seller: sellerId,
                image: [{ url: "https://ik.imagekit.io/test/keyboard.png" }],
            },
            {
                title: "Wireless Gaming Mouse",
                description: "Ergonomic optical gaming mouse with 16000 DPI",
                price: { amount: 1500, currency: "INR" },
                seller: sellerId,
                image: [{ url: "https://ik.imagekit.io/test/mouse.png" }],
            },
            {
                title: "Noise Cancelling Headphones",
                description: "Over-ear bluetooth headphones with deep bass",
                price: { amount: 6000, currency: "INR" },
                seller: sellerId,
                image: [{ url: "https://ik.imagekit.io/test/headphones.png" }],
            },
        ]);
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // 1. Fetching all products
    // ═══════════════════════════════════════════════════════════════════════════
    describe("General Product Listing", () => {
        it("should return empty array when no products exist", async () => {
            const res = await request(app).get("/api/products");

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(Array.isArray(res.body.data.products)).toBe(true);
            expect(res.body.data.products.length).toBe(0);
        });

        it("should return all products when products exist", async () => {
            await seedProducts();

            const res = await request(app).get("/api/products");

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.products.length).toBe(3);
            expect(res.body.data.products[0]).toHaveProperty("title");
            expect(res.body.data.products[0]).toHaveProperty("price");
            expect(res.body.data.products[0].price).toHaveProperty("amount");
        });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // 2. Search filtering (?q=)
    // ═══════════════════════════════════════════════════════════════════════════
    describe("Search Filtering (?q=)", () => {
        it("should return only products matching the search query", async () => {
            await seedProducts();

            const res = await request(app).get("/api/products?q=Keyboard");

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.products.length).toBe(1);
            expect(res.body.data.products[0].title).toBe("Wireless Mechanical Keyboard");
        });

        it("should return empty list when search query matches nothing", async () => {
            await seedProducts();

            const res = await request(app).get("/api/products?q=NonExistingProductXYZ");

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.products.length).toBe(0);
        });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // 3. Price filtering (?minprice= & ?maxprice=)
    // ═══════════════════════════════════════════════════════════════════════════
    describe("Price Range Filtering", () => {
        it("should filter products with minprice", async () => {
            await seedProducts();

            const res = await request(app).get("/api/products?minprice=3000");

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            // 3500 aur 6000 aane chahiye
            expect(res.body.data.products.length).toBe(2);
            res.body.data.products.forEach((p) => {
                expect(p.price.amount).toBeGreaterThanOrEqual(3000);
            });
        });

        it("should filter products with maxprice", async () => {
            await seedProducts();

            const res = await request(app).get("/api/products?maxprice=2000");

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            // Sirf 1500 wala aana chahiye
            expect(res.body.data.products.length).toBe(1);
            expect(res.body.data.products[0].price.amount).toBe(1500);
        });

        it("should filter products within minprice and maxprice range", async () => {
            await seedProducts();

            const res = await request(app).get("/api/products?minprice=2000&maxprice=5000");

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            // Sirf 3500 wala aana chahiye
            expect(res.body.data.products.length).toBe(1);
            expect(res.body.data.products[0].price.amount).toBe(3500);
        });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // 4. Pagination (?skip= & ?limit=)
    // ═══════════════════════════════════════════════════════════════════════════
    describe("Pagination (?skip= & ?limit=)", () => {
        it("should limit the number of returned products", async () => {
            await seedProducts();

            const res = await request(app).get("/api/products?limit=2");

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.products.length).toBe(2);
        });

        it("should skip products correctly", async () => {
            await seedProducts();

            const res = await request(app).get("/api/products?skip=2&limit=2");

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.products.length).toBe(1);
        });
    });
});

