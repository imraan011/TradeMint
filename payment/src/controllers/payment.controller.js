import "dotenv/config";
import axios from "axios";
import mongoose from "mongoose";
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
        const currency = orderResponse.data.order.currency || "INR";

        // Razorpay amount paise mein leta hai (rupees * 100)
        const razorpayOrder = await razorpay.orders.create({
            amount: Math.round(totalAmount * 100),
            currency,
            receipt: `receipt_${orderId}`,
        });

        const payment = await PaymentModel.create({
            order: orderId,
            razorpay_order_id: razorpayOrder.id,
            user: req.user.id || req.user._id,
            amount: totalAmount,
            currency,
            status: "pending",
        });

        return res.status(201).json({
            success: true,
            message: "Payment initialized successfully",
            payment,
        });
    } catch (error) {
        return res.status(500).json({ success: false, error: { message: error.message || "Internal server error" } });
    }
};

export const verifyPaymentController = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

        const secret = process.env.RAZORPAY_KEY_SECRET;
        if (!secret) {
            return res
                .status(500)
                .json({ success: false, error: { message: "Razorpay secret key is not configured" } });
        }

        const isValid = validatePaymentVerification(
            {
                order_id: razorpay_order_id,
                payment_id: razorpay_payment_id,
            },
            razorpay_signature,
            secret,
        );
        if (!isValid) {
            return res.status(400).json({ success: false, message: "Invalid payment signature" });
        }

        const payment = await PaymentModel.findOne({ razorpay_order_id, status: "pending" });

        if (!payment) {
            return res.status(404).json({ success: false, message: "Payment not found or already verified" });
        }

        payment.razorpay_payment_id = razorpay_payment_id;
        payment.razorpay_signature = razorpay_signature;
        payment.status = "completed";

        await payment.save();

        return res.status(200).json({
            success: true,
            message: "Payment verified successfully",
            payment,
        });
    } catch (error) {
        return res.status(500).json({ success: false, error: { message: error.message || "Internal server error" } });
    }
};

export const getPaymentByIdController = async (req, res) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
            success: false,
            error: { message: "Invalid payment ID format" },
        });
    }

    try {
        const payment = await PaymentModel.findById(id);

        if (!payment) {
            return res.status(404).json({
                success: false,
                error: { message: "Payment record not found" },
            });
        }

        const currentUser = req.user;
        const currentUserId = currentUser.id || currentUser._id;
        const userRoles = currentUser.role || currentUser.roles || [];
        const isAdmin = Array.isArray(userRoles)
            ? userRoles.map((r) => String(r).toUpperCase()).includes("ADMIN")
            : String(userRoles).toUpperCase() === "ADMIN";

        // RBAC check: Sirf payment owner ya admin access kar sakta hai
        if (!isAdmin && payment.user.toString() !== currentUserId.toString()) {
            return res.status(403).json({
                success: false,
                error: { message: "Forbidden! You do not have permission to view this payment" },
            });
        }

        return res.status(200).json({
            success: true,
            payment,
        });
    } catch (error) {
        console.error("Error fetching payment:", error);
        return res.status(500).json({ success: false, error: { message: error.message || "Internal server error" } });
    }
};
