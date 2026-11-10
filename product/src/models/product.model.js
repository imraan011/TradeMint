import mongoose from "mongoose";

const productSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
    },
    description: {
        type: String,
    },
    price: {
        amount: {
            type: Number,
            required: true,
        },
        currency: {
            type: String,
            enum: ["USD", "INR"],
            default: "INR",
        },
    },
    seller: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
    },
    image: [
        {
            url: String,
            thumbnail: String,
            id: String,
        },
    ],
});

productSchema.index({
    title: "text",
    description: "text",
});

export const ProductModel = mongoose.model("Product", productSchema);
