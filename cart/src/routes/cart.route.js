import express from "express";
import {
    addToCartController,
    clearCartController,
    getCartController,
    removeCartItemController,
    updateCartItemController,
} from "../controllers/cart.controller.js";
import { createAuthMiddleware } from "../middlewares/auth.middleware.js";
import { validateAddToCart, validateUpdateCart } from "../middlewares/validation.middleware.js";

const router = express.Router();

router.get("/", createAuthMiddleware(["USER", "User"]), getCartController);
router.post("/items", createAuthMiddleware(["USER", "User"]), validateAddToCart, addToCartController);
router.patch("/items/:productId", createAuthMiddleware(["USER", "User"]), validateUpdateCart, updateCartItemController);
router.delete("/items/:productId", createAuthMiddleware(["USER", "User"]), removeCartItemController);
router.delete("/", createAuthMiddleware(["USER", "User"]), clearCartController);

export default router;
