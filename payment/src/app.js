import cookieParser from "cookie-parser";
import express from "express";
import paymentRouter from "./routes/payment.route.js";

export const app = express();

app.use(express.json());
app.use(cookieParser());

app.use("/api/payments", paymentRouter);
