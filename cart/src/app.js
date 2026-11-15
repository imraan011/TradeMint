import cookieParser from "cookie-parser";
import express from "express";
import cartRouter from "./routes/cart.route.js";

export const app = express();

app.use(express.json());
app.use(cookieParser());

app.use("/api", cartRouter);
