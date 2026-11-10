import { uploadImage } from "../services/imagekit.service.js";
import { ProductModel } from "../models/product.model.js";

//accept multipart/form-data with images : {title , description, price.amount, price.currency, images[] }
export async function createProductController(req, res) {
    try {
        const { title, description } = req.body;

        const rawAmount =
            req.body.price?.amount ??
            req.body["price.amount"] ??
            req.body.amount;
        const rawCurrency =
            req.body.price?.currency ??
            req.body["price.currency"] ??
            req.body.currency ??
            "INR";

        const price = {
            amount: Number(rawAmount),
            currency: rawCurrency,
        };
        const sellerId = req.user.id || req.user._id;

        // Kam se kam ek image zaroori hai
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                error: { message: "At least one image is required" },
            });
        }

        // ImageKit pe upload (test mode me mock ho jayega)
        const uploadedImages = await Promise.all(req.files.map((file) => uploadImage({ buffer: file.buffer })));

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
            message: "Product created successfully",
            data: { product },
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: { message: `Internal server error: ${error.message}` },
        });
    }
}

export async function getProductController(req, res) {
    try {
        const { q, skip = 0, limit = 20 } = req.query;
        const minPrice = req.query.minprice ?? req.query.minPrice;
        const maxPrice = req.query.maxprice ?? req.query.maxPrice;

        const filter = {};

        // Title aur description pe full-text search
        if (q) {
            filter.$text = { $search: q };
        }

        // Price range filter
        if (minPrice) {
            filter["price.amount"] = {
                ...filter["price.amount"],
                $gte: Number(minPrice),
            };
        }
        if (maxPrice) {
            filter["price.amount"] = {
                ...filter["price.amount"],
                $lte: Number(maxPrice),
            };
        }

        const products = await ProductModel.find(filter)
            .skip(Number(skip))
            .limit(Number(limit));

        return res.status(200).json({
            success: true,
            message: "Products fetched successfully",
            data: { products },
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: { message: "Internal server error" },
        });
    }
}
