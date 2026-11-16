import express from "express";
import { addToCartController, updateCartItemController } from "../controller/cart.controller.js";
import { createAuthMiddleware } from "../middlewares/auth.middleware.js";
import { validateAddToCart, validateUpdateCart } from "../middlewares/validation.middleware.js";

const router = express.Router();

router.post("/items", createAuthMiddleware(["USER", "User"]), validateAddToCart, addToCartController);
router.patch("/items/:productId", createAuthMiddleware(["USER", "User"]), validateUpdateCart, updateCartItemController);

export default router;
