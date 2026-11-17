import mongoose from "mongoose";

const addressSchema = new mongoose.Schema({
    street: {
        type: String,
        required: true,
    },
    city: {
        type: String,
        required: true,
    },
    state: {
        type: String,
        required: true,
    },
    pincode: {
        type: String,
        required: true,
    },
    country: {
        type: String,
        required: true,
    },
    isDefault: {
        type: Boolean,
        default: false,
    },
});

const orderSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
        },
        shippingAddress: addressSchema,
        items: [
            {
                productId: {
                    type: mongoose.Schema.Types.ObjectId,
                    required: true,
                },
                quantity: {
                    type: Number,
                    required: true,
                    default: 1,
                    min: 1,
                },
                price: {
                    amount: {
                        type: Number,
                        required: true,
                    },
                    currency: {
                        type: String,
                        required: true,
                        enum: ["USD", "INR"], // Add more currencies as needed
                    },
                },
            },
        ],
        status: {
            type: String,
            enum: ["PENDING", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"],
        },
        totalAmount: {
            amount: {
                type: Number,
                required: true,
            },
            currency: {
                type: String,
                required: true,
                enum: ["USD", "INR"],
            },
        },
    },
    { timestamps: true },
);

const OrderModel = mongoose.model("Order", orderSchema);

export default OrderModel;
