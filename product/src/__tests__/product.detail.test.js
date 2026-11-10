/**
 * Test suite for GET /api/products/:id
 *
 * Tests:
 * 1. Fetching single product by valid ID (200 OK)
 * 2. Product not found with non-existent ObjectId (404 Not Found)
 * 3. Invalid/malformed ObjectId format (400 Bad Request)
 */

import { describe, it, expect } from "@jest/globals";
import "dotenv/config";
import request from "supertest";
import mongoose from "mongoose";
import { app } from "../app.js";
import { ProductModel } from "../models/product.model.js";

describe("GET /api/products/:id", () => {
    const sellerId = new mongoose.Types.ObjectId();

    // ═══════════════════════════════════════════════════════════════════════════
    // 1. Happy Path (200 OK)
    // ═══════════════════════════════════════════════════════════════════════════
    describe("Successful Product Retrieval", () => {
        it("should return 200 and product details when product exists", async () => {
            const created = await ProductModel.create({
                title: "Sony WH-1000XM5",
                description: "Industry leading noise cancelling headphones",
                price: { amount: 26990, currency: "INR" },
                seller: sellerId,
                image: [
                    {
                        url: "https://ik.imagekit.io/test/sony.png",
                        thumbnail: "https://ik.imagekit.io/test/sony-thumb.png",
                        id: "img_sony_1",
                    },
                ],
            });

            const res = await request(app).get(`/api/products/${created._id}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);

            const product = res.body.productData;
            expect(product).toBeDefined();
            expect(product._id).toBe(created._id.toString());
            expect(product.title).toBe("Sony WH-1000XM5");
            expect(product.description).toBe("Industry leading noise cancelling headphones");
            expect(product.price.amount).toBe(26990);
            expect(product.price.currency).toBe("INR");
            expect(product.seller.toString()).toBe(sellerId.toString());
            expect(product.image).toHaveLength(1);
            expect(product.image[0].url).toBe("https://ik.imagekit.io/test/sony.png");
        });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // 2. Not Found (404 Not Found)
    // ═══════════════════════════════════════════════════════════════════════════
    describe("Product Not Found", () => {
        it("should return 404 when product ID does not exist in DB", async () => {
            const nonExistentId = new mongoose.Types.ObjectId();

            const res = await request(app).get(`/api/products/${nonExistentId}`);

            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
            expect(res.body.error.message).toMatch(/not found/i);
        });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // 3. Invalid ID format (400 Bad Request)
    // ═══════════════════════════════════════════════════════════════════════════
    describe("Invalid ID Validation", () => {
        it("should return 400 when product ID is not a valid ObjectId", async () => {
            const res = await request(app).get("/api/products/invalid-id-123");

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.error.message).toMatch(/invalid.*id/i);
        });
    });
});

