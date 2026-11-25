import express from "express";
import { connectToRabbitMQ, subscribeToQueue } from "./broker/broker.js";
import { Broker_listener } from "./broker/listerner.js";

export const app = express();

connectToRabbitMQ().then(() => {
    Broker_listener();
});

app.use(express.json());

app.get("/", (req, res) => {
    res.send("Notification Service is running");
});
