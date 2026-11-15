import express from "express";
import { addToCartController } from "../controller/cart.controller";

const router = express.Router();

export default router;

router.get("/", (req, res) => {
    res.send("Cart route is working!");
});

router.post("/add" , addToCartController);