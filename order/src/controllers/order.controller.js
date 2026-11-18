import axios from "axios";
import OrderModel from "../models/order.model.js";

export const createOrderController = async (req, res) => {
    try {
        const user = req.user;
        const token = req.cookies?.token || req.headers?.authorization?.split(" ")[1];
        if (!token) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        try {
            //fetch user's cart from cart service
            const cartResponse = await axios.get(`http://localhost:3002/api/cart`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            const products = await Promise.all(
                cartResponse.data.cart.items.map(async (items) => {
                    const response = await axios.get(`http://localhost:3001/api/products/${items.productId}`, {
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                    });
                    return response.data.productData;
                }),
            );

            console.log("product: ", products);
        } catch (error) {
            res.status(500).json({ success: false, message: "Internal Server Error", error: error.message });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: "Internal Server Error", error: error.message });
    }
};
