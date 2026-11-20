/**
 * Test suite for PATCH /api/orders/:id/address
 *
 * Spec:
 * 1. Updates delivery address prior to payment capture (status=pending).
 * 2. Rejects with 400 if shippingAddress payload is missing.
 * 3. Buyer Isolation: Returns 403 if User A attempts to update User B's order.
 * 4. Returns 404 if order does not exist.
 * 5. Returns 400 if order ID format is invalid.
 * 6. Requires valid authentication (Bearer token).
 *
 * Pattern: OrderModel.create() se DB seed karo — no POST /api/orders needed.
 * Client kabhi items/prices send nahi karta (CWE-472).
 */

import { describe, it, expect } from "@jest/globals";
import "dotenv/config";
import request from "supertest";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { app } from "../app.js";
import OrderModel from "../models/order.model.js";

const JWT_SECRET = process.env.JWT_SECRET || "test_jwt_secret";

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

const initialAddress = {
    street: "123 MG Road",
    city: "Bengaluru",
    state: "Karnataka",
    pincode: "560001",
    country: "India",
};

const updatedAddress = {
    street: "456 Indiranagar 100ft Rd",
    city: "Bengaluru",
    state: "Karnataka",
    pincode: "560038",
    country: "India",
};

/** DB seed helper */
const seedOrder = (userId, overrides = {}) =>
    OrderModel.create({
        user: userId,
        shippingAddress: initialAddress,
        items: [
            {
                productId: new mongoose.Types.ObjectId(),
                quantity: 1,
                price: { amount: 750, currency: "INR" },
            },
        ],
        status: "pending",
        totalAmount: 935,
        tax: 135,
        shippingCharges: 50,
        ...overrides,
    });

describe("PATCH /api/orders/:id/address", () => {
    // ═══════════════════════════════════════════════════════════════════════════
    // 1. Happy Path & Address Update
    // ═══════════════════════════════════════════════════════════════════════════
    describe("Successful Address Update", () => {
        it("should successfully update delivery address on a pending order", async () => {
            const { token, user } = generateAuthToken();

            const seeded = await seedOrder(user.id);

            const res = await request(app)
                .patch(`/api/orders/${seeded._id}/address`)
                .set("Authorization", `Bearer ${token}`)
                .send({ shippingAddress: updatedAddress });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);

            const order = res.body.data?.order ?? res.body.order ?? res.body.data;
            const savedAddress = order.shippingAddress ?? order.shippingAddress;
            expect(savedAddress.street).toBe(updatedAddress.street);
            expect(savedAddress.pincode).toBe(updatedAddress.pincode);
        });

        it("should prevent User A from updating User B's order address (403)", async () => {
            const { user: userA } = generateAuthToken();
            const { token: userBToken } = generateAuthToken();

            // User A ka order DB mein daal do
            const seeded = await seedOrder(userA.id);

            // User B update karne ki koshish karega
            const res = await request(app)
                .patch(`/api/orders/${seeded._id}/address`)
                .set("Authorization", `Bearer ${userBToken}`)
                .send({ shippingAddress: updatedAddress });

            expect(res.status).toBe(403);
            expect(res.body.success).toBe(false);
        });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // 2. Input Validations & Not Found (400 & 404)
    // ═══════════════════════════════════════════════════════════════════════════
    describe("Input Validations & Not Found", () => {
        it("should return 400 when new delivery address payload is missing", async () => {
            const { token } = generateAuthToken();
            const validId = new mongoose.Types.ObjectId().toString();

            const res = await request(app)
                .patch(`/api/orders/${validId}/address`)
                .set("Authorization", `Bearer ${token}`)
                .send({});

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.error.message).toMatch(/address.*required|missing/i);
        });

        it("should return 404 when order ID does not exist in DB", async () => {
            const { token } = generateAuthToken();
            const nonExistentId = new mongoose.Types.ObjectId().toString();

            const res = await request(app)
                .patch(`/api/orders/${nonExistentId}/address`)
                .set("Authorization", `Bearer ${token}`)
                .send({ shippingAddress: updatedAddress });

            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
        });

        it("should return 400 when order ID format is invalid", async () => {
            const { token } = generateAuthToken();

            const res = await request(app)
                .patch("/api/orders/invalid-object-id/address")
                .set("Authorization", `Bearer ${token}`)
                .send({ shippingAddress: updatedAddress });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.error.message).toMatch(/invalid.*id/i);
        });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // 3. Authentication Failures (401 Unauthorized)
    // ═══════════════════════════════════════════════════════════════════════════
    describe("Authentication Failures", () => {
        it("should return 401 when Authorization header is missing", async () => {
            const randomId = new mongoose.Types.ObjectId().toString();
            const res = await request(app)
                .patch(`/api/orders/${randomId}/address`)
                .send({ shippingAddress: updatedAddress });

            expect(res.status).toBe(401);
            expect(res.body.success).toBe(false);
        });

        it("should return 401 when token is invalid or expired", async () => {
            const randomId = new mongoose.Types.ObjectId().toString();
            const res = await request(app)
                .patch(`/api/orders/${randomId}/address`)
                .set("Authorization", "Bearer invalid.fake.token")
                .send({ shippingAddress: updatedAddress });

            expect(res.status).toBe(401);
            expect(res.body.success).toBe(false);
        });
    });
});
