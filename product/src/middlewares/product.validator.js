import { body, validationResult } from "express-validator";

function handleValidationErrors(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            error: {
                message: errors.array()[0].msg,
                details: errors.array(),
            },
        });
    }
    next();
}

export const createProductValidator = [
    body("title").isString().trim().notEmpty().withMessage("Title is required"),
    body("description")
        .optional()
        .isString()
        .trim()
        .isLength({ max: 500 })
        .withMessage("Description must be a string"),
    body("price.amount")
        .notEmpty()
        .withMessage("Price amount is required")
        .isNumeric()
        .withMessage("Price amount must be a number")
        .bail()
        .isFloat({ gt: 0 })
        .withMessage("Price amount must be greater than 0"),
    body("price.currency")
        .optional()
        .isIn(["USD", "INR"])
        .withMessage("Currency must be either USD or INR"),
    handleValidationErrors,
];

export const updateProductValidator =[
    body("title").isString().trim().optional().withMessage("Title must be a string"),
    body("description")
        .optional()
        .isString()
        .trim()
        .isLength({ max: 500 })
        .withMessage("Description must be a string"),
    body("price.amount")
        .optional()
        .isNumeric()
        .withMessage("Price amount must be a number")
        .bail()
        .isFloat({ gt: 0 })
        .withMessage("Price amount must be greater than 0"),
    body("price.currency")
        .optional()
        .isIn(["USD", "INR"])
        .withMessage("Currency must be either USD or INR"),
    handleValidationErrors,
];