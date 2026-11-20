import { body, validationResult } from "express-validator";

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

export const createOrderValidations = [
    body("shippingAddress").notEmpty().withMessage("Shipping address is required"),
    body("shippingAddress.street").if(body("shippingAddress").exists()).notEmpty().withMessage("Street is required"),
    body("shippingAddress.city").if(body("shippingAddress").exists()).notEmpty().withMessage("City is required"),
    body("shippingAddress.state").if(body("shippingAddress").exists()).notEmpty().withMessage("State is required"),
    body("shippingAddress.pincode").if(body("shippingAddress").exists()).notEmpty().withMessage("Pincode is required"),
    body("shippingAddress.country").if(body("shippingAddress").exists()).notEmpty().withMessage("Country is required"),

    validateResult,
];

export const updateOrderAddressValidations = [
    body("shippingAddress").notEmpty().withMessage("Shipping address is required"),
    body("shippingAddress.street").if(body("shippingAddress").exists()).notEmpty().withMessage("Street is required"),
    body("shippingAddress.city").if(body("shippingAddress").exists()).notEmpty().withMessage("City is required"),
    body("shippingAddress.state").if(body("shippingAddress").exists()).notEmpty().withMessage("State is required"),
    body("shippingAddress.pincode").if(body("shippingAddress").exists()).notEmpty().withMessage("Pincode is required"),
    body("shippingAddress.country").if(body("shippingAddress").exists()).notEmpty().withMessage("Country is required"),

    validateResult,
];
