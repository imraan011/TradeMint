import express from "express";
import { createAuthMiddleware } from "../middlewares/auth.middleware.js";
import { createPaymentController } from "../controllers/payment.controller.js";

export const router = express.Router();

router.post("/create/:orderId", createAuthMiddleware(["USER"]), createPaymentController);

export default router;
