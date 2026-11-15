import mongoose from "mongoose";

const cartSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
        },
        items: [
            {
                product: {
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
            },
        ],

        totalPrice: {
            type: Number,
            required: true,
        },
    },
    { timestamps: true },
);

const CartModel = mongoose.model("Cart", cartSchema);

export default CartModel;
