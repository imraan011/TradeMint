import { body } from "express-validator";

function responseWithValidationErrors(req, res, next) {
    const errors = req.validationErrors();
    if (errors) {
        return res.status(400).json({
            success: false,
            message: "Validation failed",
            errors: errors,
        });
    }
    next();
}

export const addAddressValidations = [
    body("street").isString().withMessage("street must be a string").notEmpty().withMessage("street is required"),
    body("city").isString().withMessage("city must be a string").notEmpty().withMessage("city is required"),
    body("state").isString().withMessage("state must be a string").notEmpty().withMessage("state is required"),
    body("pincode")
        .isString()
        .withMessage("pincode must be a string")
        .matches(/^\d{6}$/)
        .withMessage("pincode must be a 6-digit number"),
    body("country").isString().withMessage("country must be a string").notEmpty().withMessage("country is required"),
    body("phone")
        .isString()
        .withMessage("phone must be a string")
        .matches(/^\d{10}$/)
        .withMessage("phone must be a 10-digit number"),

    responseWithValidationErrors,
];
