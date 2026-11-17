import OrderModel from "../models/order.model.js";

export const createOrderController = async (req, res) => {
    try {
    } catch (error) {
        res.status(500).json({ success: false, message: "Internal Server Error", error: error.message });
    }
};
