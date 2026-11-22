import express from "express";
import { createAuthMiddleware } from "../middlewares/auth.middleware.js";
import {
    createPaymentController,
    verifyPaymentController,
    getPaymentByIdController,
} from "../controllers/payment.controller.js";

export const router = express.Router();

// 1. Create/Init Razorpay Payment
router.post("/create/:orderId", createAuthMiddleware(["USER", "User"]), createPaymentController);

// 2. Verify Payment
router.post("/verify", createAuthMiddleware(["USER", "User"]), verifyPaymentController);

// 3. Get Payment By ID (RBAC: Buyer or Admin)
router.get("/:id", createAuthMiddleware(["USER", "ADMIN", "User", "Admin"]), getPaymentByIdController);

export default router;
