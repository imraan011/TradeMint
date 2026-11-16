import { body, param, validationResult } from "express-validator";
import mongoose from "mongoose";

function validateResult(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            error: { message: errors.array()[0].msg },
        });
    }
    next();
}

export const validateAddToCart = [
    body("productId")
        .notEmpty()
        .withMessage("Product ID is required")
        .custom((value) => mongoose.Types.ObjectId.isValid(value))
        .withMessage("Invalid Product ID: must be a valid ObjectId"),
    body().custom((reqBody) => {
        const rawQty = reqBody.quantity ?? reqBody.qty;
        if (rawQty === undefined || rawQty === null || rawQty === "") {
            throw new Error("Quantity is required");
        }
        const qtyNum = Number(rawQty);
        if (!Number.isFinite(qtyNum) || !Number.isInteger(qtyNum) || qtyNum <= 0) {
            throw new Error("Quantity must be a positive integer greater than 0");
        }
        return true;
    }),
    validateResult,
];

export const validateUpdateCart = [
    param("productId")
        .custom((value) => mongoose.Types.ObjectId.isValid(value))
        .withMessage("Invalid Product ID: must be a valid ObjectId"),
    body().custom((reqBody) => {
        const rawQty = reqBody.quantity ?? reqBody.qty;
        if (rawQty === undefined || rawQty === null || rawQty === "") {
            throw new Error("Quantity is required");
        }
        const qtyNum = Number(rawQty);
        if (!Number.isFinite(qtyNum)) {
            throw new Error("Quantity must be a valid number");
        }
        return true;
    }),
    validateResult,
];
