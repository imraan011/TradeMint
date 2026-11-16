import { body, validationResult } from "express-validator";
import mongoose from "mongoose";

function validateResult(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    next();
}

export const validateAddToCart = [
    body("productId")
        .isString()
        .notEmpty()
        .withMessage("Product ID is required")
        .custom((value) => {
            return mongoose.Types.ObjectId.isValid(value);
        })
        .withMessage("Invalid Product ID"),
    body("quantity").isInt({ min: 1 }).withMessage("Quantity must be a positive integer"),
    validateResult,
];
