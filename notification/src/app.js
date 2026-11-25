import express from "express";
import { connectToRabbitMQ } from "./broker/broker.js";

export const app = express();

connectToRabbitMQ();
app.use(express.json());

app.get("/", (req, res) => {
    res.send("Notification Service is running");
});
