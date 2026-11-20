import { sign } from "jsonwebtoken";
import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
    {
        order: {
            type: Mongoose.Schema.Types.ObjectId,
            required: true,
        },
        paymentId: {
            type: String,
        },
        razorpay_order_id: {
            type: String,
            required: true,
        },
        signature: {
            type: String,
        },
        status: {
            type: String,
            enum: ["pending", "completed", "failed"],
            default: "pending",
        },
        user: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
        },
    },
    { timestamps: true },
);

export const PaymentModel = mongoose.model("Payment", paymentSchema);
