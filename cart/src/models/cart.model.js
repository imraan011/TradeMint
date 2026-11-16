import mongoose from "mongoose";

const cartItemSchema = new mongoose.Schema(
    {
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
        },
        quantity: {
            type: Number,
            required: true,
            min: 1,
        },
    },
    { _id: false },
);

const cartSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            unique: true,
        },
        items: [cartItemSchema],
        totalAmount: {
            type: Number,
            default: 0,
        },
    },
    { timestamps: true },
);

const CartModel = mongoose.model("Cart", cartSchema);

export default CartModel;
