import express from "express";
import { createAuthMiddleware } from "../middlewares/auth.middleware.js";
import { createOrderController } from "../controllers/order.controller.js";
import { createOrderValidations } from "../middlewares/validation.middleware.js";

const router = express.Router();

router.post("/", createAuthMiddleware(["User", "USER"]), createOrderValidations, createOrderController);

export default router;
    