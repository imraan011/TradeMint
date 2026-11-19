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

            let priceAmount = 0;
            const orderItems = cartResponse.data.cart.items.map((item, index) => {
                const product = products.find((p) => p._id.toString() == item.productId.toString());

                if (product.stock === undefined || product.stock === null || product.stock < item.quantity) {
                    throw new Error(`Product ${product.title} is out of stock`);
                }
                const itemPrice = product.price.amount * item.quantity;
                priceAmount += itemPrice;
                return {
                    productId: item.productId,
                    quantity: item.quantity,
                    price: {
                        amount: itemPrice,
                        currency: product.price.currency,
                    },
                };
            });

            const shippingAddress = req.body?.shippingAddress;

            if (!shippingAddress) {
                return res.status(400).json({
                    success: false,
                    message: "Shipping address is required to place an order!",
                });
            }

            const order = new OrderModel({
                user: user.id || user._id,
                shippingAddress,
                items: orderItems,
                status: "PENDING",
                totalAmount: {
                    amount: priceAmount,
                    currency: orderItems[0].price.currency || "INR",
                },
            });
            await order.save();
            console.log("Order saved successfully in DB:", order._id);

            return res.status(201).json({
                success: true,
                message: "Order created successfully",
                data: { order },
            });
        } catch (error) {
            res.status(500).json({ success: false, message: "Internal Server Error", error: error.message });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: "Internal Server Error", error: error.message });
    }
};
