import express from "express";
import { addToCartController } from "../controller/cart.controller.js";
import { createAuthMiddleware } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/items", createAuthMiddleware(["USER"]), addToCartController);

export default router;
