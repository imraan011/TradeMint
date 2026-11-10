import { uploadImage } from "../services/imagekit.service.js";
import { ProductModel } from "../models/product.model.js";

export async function productController(req, res) {
    try {
        const { title, description} = req.body;

        const price={
            amount: Number(req.body["price.amount"]),
            currency:req.body["price.currency"]
        }
        const sellerId = req.user.id || req.user._id;

        // Kam se kam ek image zaroori hai
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                error: { message: "At least one image is required" },
            });
        }

        // ImageKit pe upload (test mode me mock ho jayega)
        const uploadedImages = await Promise.all(
            req.files.map((file) => uploadImage({ buffer: file.buffer })),
        );

        const product = await ProductModel.create({
            title,
            description,
            price,
            seller: sellerId,
            image: uploadedImages.map((img) => ({
                url: img.url,
                thumbnail: img.thumbnailUrl,
                id: img.id,
            })),
        });

        return res.status(201).json({
            success: true,
            data: { product },
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: { message: `Internal server error: ${error.message}` },
        });
    }
}
