import axios from "axios";
import { PaymentModel } from "../models/payment.model.js";
import razorpay from "../config/razorpay.js";

export const createPaymentController = async (req, res) => {
    try {
        const token = req.cookies?.token || req.headers.authorization?.split(" ")[1];
        const orderId = req.params.orderId;
        const orderResponse = await axios.get(`http://localhost:3003/api/orders/${orderId}`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });

        const totalAmount = orderResponse.data.order.totalAmount;
        const currency = orderResponse.data.order.currency;

        // Razorpay amount paise mein leta hai (rupees * 100)
        const razorpayOrder = await razorpay.orders.create({
            amount: Math.round(totalAmount * 100),
            currency,
            receipt: `receipt_${orderId}`,
        });

        const payment = await PaymentModel.create({
            order: orderId,
            razorpay_order_id: razorpayOrder.id,
            user: req.user.id,
            amount: totalAmount,
            currency: "INR",
        });

        return res.status(201).json({
            success: true,
            message: "Payment initialized successfully",
            data: {
                razorpay_order_id: razorpayOrder.id,
                amount: razorpayOrder.amount,
                currency: razorpayOrder.currency,
                payment,
            },
        });
    } catch (error) {
        console.error("Error creating payment:", error);
        res.status(500).json({ error: "Internal server error", message: error.message });
    }
};
