import axios from "axios";
import { PaymentModel } from "../models/payment.model.js";
import razorpay from "../config/razorpay.js";
import { validatePaymentVerification } from "razorpay/dist/utils/razorpay-utils.js";

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
            payment,
        });
    } catch (error) {
        console.error("Error creating payment:", error);
        res.status(500).json({ error: "Internal server error", message: error.message });
    }
};

export const verifyPaymentController = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

        const isValid = validatePaymentVerification(
            {
                order_id: razorpay_order_id,
                payment_id: razorpay_payment_id,
                signature: razorpay_signature,
            },
            process.env.RAZORPAY_KEY_SECRET,
        );
        if (!isValid) {
            return res.status(400).json({ success: false, message: "Invalid payment signature" });
        }

        const payment = await PaymentModel.findOne({ razorpay_order_id, status: "PENDING" });

        if (!payment) {
            return res.status(404).json({ success: false, message: "Payment not found or already verified" });
        }

        payment.razorpay_payment_id = razorpay_payment_id;
        payment.razorpay_signature = razorpay_signature;
        payment.status = "COMPLETED";

        await payment.save();

        return res.status(200).json({
            success: true,
            message: "Payment verified successfully",
            payment,
        });
        
    } catch (error) {
        console.error("Error verifying payment:", error);
        res.status(500).json({ error: "Internal server error", message: error.message });
    }
};
