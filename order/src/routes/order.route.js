import express from "express";
import { createAuthMiddleware } from "../middlewares/auth.middleware.js";
import {
    createOrderController,
    deleteOrderController,
    getOrderByIdController,
    getUserOrdersController,
    updateOrderAddressController,
} from "../controllers/order.controller.js";
import { createOrderValidations, updateOrderAddressValidations } from "../middlewares/validation.middleware.js";

const router = express.Router();

router.post("/", createAuthMiddleware(["User", "USER"]), createOrderValidations, createOrderController);

router.get("/me", createAuthMiddleware(["User", "USER"]), getUserOrdersController);

router.get("/:orderId", createAuthMiddleware(["User", "USER"]), getOrderByIdController);

router.post("/:orderId/cancel", createAuthMiddleware(["User", "USER"]), deleteOrderController);

router.patch(
    "/:orderId/address",
    createAuthMiddleware(["User", "USER"]),
    updateOrderAddressValidations,
    updateOrderAddressController,
);

export default router;
