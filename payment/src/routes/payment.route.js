import express from "express";
import { createAuthMiddleware } from "../middlewares/auth.middleware.js";
import { createPaymentController, verifyPaymentController } from "../controllers/payment.controller.js";

export const router = express.Router();

router.post("/create/:orderId", createAuthMiddleware(["USER"]), createPaymentController);

router.post("/verify", createAuthMiddleware(["USER"]), verifyPaymentController);



export default router;
