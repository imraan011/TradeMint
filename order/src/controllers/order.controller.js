import axios from "axios";
import OrderModel from "../models/order.model.js";
import mongoose from "mongoose";

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

export const getUserOrdersController = async (req, res) => {
    try {
        const user = req.user;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const orders = await OrderModel.find({ user: user.id || user._id })
            //-1 shows latest orders first, 1 shows oldest orders first
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);
        const totalOrders = await OrderModel.countDocuments({ user: user.id || user._id });

        return res.status(200).json({
            success: true,
            message: "User orders fetched successfully",
            orders,
            meta: {
                total: totalOrders,
                page,
                limit,
                totalPages: Math.ceil(totalOrders / limit),
            },
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: { message: error.message || "Internal Server Error" },
        });
    }
};

export const getOrderByIdController = async (req, res) => {
    const { orderId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
        return res.status(400).json({
            success: false,
            error: { message: "Invalid order ID" },
        });
    }

    try {
        // Buyer isolation: sirf us user ka order fetch karo jisne request ki hai
        const order = await OrderModel.findOne({ _id: orderId, user: req.user.id });

        if (!order) {
            // Order exists but belongs to someone else → 403, doesn't exist → 404
            const exists = await OrderModel.exists({ _id: orderId });
            if (exists) {
                return res.status(403).json({ success: false, error: { message: "Forbidden" } });
            }
            return res.status(404).json({
                success: false,
                error: { message: "Order not found" },
            });
        }

        return res.status(200).json({
            success: true,
            message: "Order fetched successfully",
            order,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: { message: error.message || "Internal Server Error" },
        });
    }
};

export const deleteOrderController = async (req, res) => {
    const user = req.user;
    const { orderId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
        return res.status(400).json({
            success: false,
            error: { message: "Invalid order ID" },
        });
    }

    try {
        const order = await OrderModel.findOne({ _id: orderId, user: user.id || user._id });

        if (!order) {
            const exists = await OrderModel.exists({ _id: orderId });
            if (exists) {
                return res.status(403).json({ success: false, error: { message: "Forbidden" } });
            }
            return res.status(404).json({
                success: false,
                error: { message: "Order not found" },
            });
        }

        if (order.status !== "pending" && order.status !== "PENDING") {
            return res.status(400).json({
                success: false,
                error: { message: "Order is already cancelled or cannot be cancelled" },
            });
        }

        order.status = "canceled";
        order.canceledAt = new Date();
        await order.save();

        return res.status(200).json({
            success: true,
            message: "Order canceled successfully",
            order,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: { message: error.message || "Internal Server Error" },
        });
    }
};

export const updateOrderAddressController = async (req, res) => {
    const user = req.user;
    const { orderId } = req.params;
    const { shippingAddress } = req.body;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
        return res.status(400).json({
            success: false,
            error: { message: "Invalid order ID" },
        });
    }
    try {
        const order = await OrderModel.findOne({ _id: orderId, user: user.id || user._id });

        if (!order) {
            const exists = await OrderModel.exists({ _id: orderId });
            if (exists) {
                return res.status(403).json({ success: false, error: { message: "Forbidden" } });
            }
            return res.status(404).json({
                success: false,
                error: { message: "Order not found" },
            });
        }

        if (order.status !== "pending" && order.status !== "PENDING") {
            return res.status(400).json({
                success: false,
                error: { message: "Order is already processed or cannot be updated" },
            });
        }

        order.shippingAddress = {
            street: shippingAddress.street,
            city: shippingAddress.city,
            state: shippingAddress.state,
            pincode: shippingAddress.pincode,
            country: shippingAddress.country,
        };
        await order.save();

        return res.status(200).json({
            success: true,
            message: "Order address updated successfully",
            order,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: { message: error.message || "Internal Server Error" },
        });
    }
};
