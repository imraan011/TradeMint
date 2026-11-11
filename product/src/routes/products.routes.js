import { Router } from "express";
import multer from "multer";
import { createAuthMiddleware } from "../middlewares/auth.middleware.js";
import {
    createProductController,
    getProductByIdController,
    getProductController,
    updateProductController,
} from "../controllers/product.controller.js";
import { createProductValidator, updateProductValidator } from "../middlewares/product.validator.js";

const upload = multer({ storage: multer.memoryStorage() });
const router = Router();

// POST /api/products route
router.post(
    "/",
    createAuthMiddleware(["Seller", "Admin", "SELLER", "ADMIN"]),
    upload.array("images", 5),
    createProductValidator,
    createProductController,
);

// GET /api/products route
router.get("/", getProductController);

//GET /api/products/:id route
router.get("/:id", getProductByIdController);

//PATCH /api/products/:id route // protected route
router.patch("/:id", createAuthMiddleware(["Seller", "Admin", "SELLER", "ADMIN"]), updateProductValidator ,updateProductController);

export default router;
    