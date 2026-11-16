import CartModel from "../models/cart.model.js";

export async function addToCartController(req, res) {
    try {
        const { productId } = req.body;
        const quantity = Number(req.body.quantity ?? req.body.qty);

        // JWT payload se user id nikalo — id ya _id dono support karo
        const userId = req.user?.id || req.user?._id;

        let cart = await CartModel.findOne({ user: userId });

        if (!cart) {
            cart = new CartModel({
                user: userId,
                items: [],
                totalAmount: 0,
            });
        }

        const existingItemIndex = cart.items.findIndex(
            (item) => item.productId.toString() === productId,
        );

        if (existingItemIndex >= 0) {
            cart.items[existingItemIndex].quantity += quantity;
        } else {
            cart.items.push({ productId, quantity });
        }

        await cart.save();

        return res.status(200).json({
            success: true,
            message: "Item added to cart successfully",
            data: { cart },
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: { message: error.message || "Failed to add item to cart" },
        });
    }
}
