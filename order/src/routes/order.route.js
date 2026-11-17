import express from "express";
import { createAuthMiddleware } from "../middlewares/auth.middleware.js";
import { createOrderController } from "../controllers/order.controller.js";

const router = express.Router();

router.post("/", createAuthMiddleware(["User", "USER"]), createOrderController);

export default router;
