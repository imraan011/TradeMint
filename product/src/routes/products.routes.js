import { Router } from "express";
import multer from "multer";
import { createAuthMiddleware } from "../middlewares/auth.middleware.js";
import {
    createProductController,
    getProductController,
} from "../controllers/product.controller.js";
import { createProductValidator } from "../middlewares/product.validator.js";

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
export default router;
