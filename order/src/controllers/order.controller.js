import axios from "axios";
import OrderModel from "../models/order.model.js";

export const createOrderController = async (req, res) => {
    try {
        const user = req.user;
        const token = req.cookies?.token || req.headers?.authorization?.split(" ")[1];
        if (!token) {
            return res.status(401).json({ success: false, error: { message: "Unauthorized" } });
        }

        const { shippingAddress } = req.body;

        // 1. Fetch user's cart from Cart Service (Prevents Client-Side Tampering)
        const cartResponse = await axios.get(`http://localhost:3002/api/cart`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });

        const cartItems = cartResponse.data.cart?.items;
        if (!cartItems || cartItems.length === 0) {
            return res.status(400).json({
                success: false,
                error: { message: "Cart is empty. Cannot create order." },
            });
        }

        // 2. Fetch authoritative price and stock from Product Service
        const products = await Promise.all(
            cartItems.map(async (cartItem) => {
                const response = await axios.get(`http://localhost:3001/api/products/${cartItem.productId}`, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                });
                return response.data.productData || response.data;
            }),
        );

        let itemSubtotal = 0;
        const orderItems = cartItems.map((cartItem) => {
            const product = products.find((p) => p._id.toString() === cartItem.productId.toString());

            if (!product) {
                throw new Error(`Product not found: ${cartItem.productId}`);
            }

            if (product.stock !== undefined && product.stock !== null && product.stock < cartItem.quantity) {
                throw new Error(`Product ${product.title} is out of stock`);
            }

            const unitPrice = product.price.amount;
            const itemPrice = unitPrice * cartItem.quantity;
            itemSubtotal += itemPrice;

            return {
                productId: cartItem.productId,
                quantity: cartItem.quantity,
                price: {
                    amount: unitPrice,
                    currency: product.price.currency || "INR",
                },
            };
        });

        // 3. Compute taxes and shipping charges
        const tax = Math.round(itemSubtotal * 0.18);
        const shippingCharges = itemSubtotal > 1000 ? 0 : 50;
        const totalAmount = itemSubtotal + tax + shippingCharges;

        // 4. Create and save order in Database
        const order = new OrderModel({
            user: user.id || user._id,
            shippingAddress,
            items: orderItems,
            status: "pending",
            totalAmount,
            tax,
            shippingCharges,
        });

        await order.save();

        return res.status(201).json({
            success: true,
            message: "Order created successfully",
            data: { order },
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: { message: error.message || "Internal Server Error" },
        });
    }
};
