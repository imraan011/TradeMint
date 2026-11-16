/**
 * Test suite for PATCH /api/orders/:id/address
 *
 * Spec:
 * 1. Updates delivery address prior to payment capture (status=pending).
 * 2. Validates address fields (street, city, state, pincode, phone).
 * 3. Rejects with 400 if order status is no longer eligible for address change (e.g. shipped/delivered).
 * 4. Buyer Isolation: Returns 403 if User A attempts to update User B's order delivery address.
 * 5. Returns 404 if order does not exist.
 * 6. Returns 400 if order ID format is invalid.
 * 7. Requires valid authentication (Bearer token).
 */

import { describe, it, expect } from "@jest/globals";
import "dotenv/config";
import request from "supertest";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { app } from "../app.js";

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
    phone: "9876543210",
};

const updatedAddress = {
    street: "456 Indiranagar 100ft Rd",
    city: "Bengaluru",
    state: "Karnataka",
    pincode: "560038",
    country: "India",
    phone: "9123456780",
};

describe("PATCH /api/orders/:id/address", () => {
    // ═══════════════════════════════════════════════════════════════════════════
    // 1. Happy Path & Address Update
    // ═══════════════════════════════════════════════════════════════════════════
    describe("Successful Address Update", () => {
        it("should successfully update delivery address prior to payment capture", async () => {
            const { token } = generateAuthToken();
            const productId = new mongoose.Types.ObjectId().toString();

            // Pehle order create karo (status=pending)
            const createRes = await request(app)
                .post("/api/orders")
                .set("Authorization", `Bearer ${token}`)
                .send({
                    items: [{ productId, title: "Desk Lamp", price: 750, quantity: 1 }],
                    shippingAddress: initialAddress,
                });

            const createdOrder = createRes.body.data?.order || createRes.body.order || createRes.body.data;
            const orderId = createdOrder._id || createdOrder.id;

            // Address update karo
            const res = await request(app)
                .patch(`/api/orders/${orderId}/address`)
                .set("Authorization", `Bearer ${token}`)
                .send({ deliveryAddress: updatedAddress });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);

            const order = res.body.data?.order || res.body.order || res.body.data;
            const savedAddress = order.shippingAddress || order.deliveryAddress;
            expect(savedAddress.street).toBe(updatedAddress.street);
            expect(savedAddress.pincode).toBe(updatedAddress.pincode);
        });

        it("should prevent User A from updating User B's order delivery address", async () => {
            const { token: userAToken } = generateAuthToken();
            const { token: userBToken } = generateAuthToken();

            // User A order banata hai
            const createRes = await request(app)
                .post("/api/orders")
                .set("Authorization", `Bearer ${userAToken}`)
                .send({
                    items: [{ productId: new mongoose.Types.ObjectId().toString(), price: 600, quantity: 1 }],
                    shippingAddress: initialAddress,
                });

            const orderA = createRes.body.data?.order || createRes.body.order || createRes.body.data;
            const orderAId = orderA._id || orderA.id;

            // User B address update karne ki koshish karega
            const res = await request(app)
                .patch(`/api/orders/${orderAId}/address`)
                .set("Authorization", `Bearer ${userBToken}`)
                .send({ deliveryAddress: updatedAddress });

            expect([403, 404]).toContain(res.status);
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
                .send({ deliveryAddress: updatedAddress });

            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
        });

        it("should return 400 when order ID format is invalid", async () => {
            const { token } = generateAuthToken();

            const res = await request(app)
                .patch("/api/orders/invalid-object-id/address")
                .set("Authorization", `Bearer ${token}`)
                .send({ deliveryAddress: updatedAddress });

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
                .send({ deliveryAddress: updatedAddress });

            expect(res.status).toBe(401);
            expect(res.body.success).toBe(false);
        });

        it("should return 401 when token is invalid or expired", async () => {
            const randomId = new mongoose.Types.ObjectId().toString();
            const res = await request(app)
                .patch(`/api/orders/${randomId}/address`)
                .set("Authorization", "Bearer invalid.fake.token")
                .send({ deliveryAddress: updatedAddress });

            expect(res.status).toBe(401);
            expect(res.body.success).toBe(false);
        });
    });
});
