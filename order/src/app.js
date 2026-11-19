import express from "express";
import cookieParser from "cookie-parser";
import orderRouter from "./routes/order.route.js";

export const app = express();

app.use(express.json());
app.use(cookieParser());

app.use("/api/orders", orderRouter);
