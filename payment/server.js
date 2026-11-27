import "dotenv/config.js";
import { app } from "./src/app.js";
import { connectDB } from "./src/db/db.js";
import dns from "dns";
import { connectToRabbitMQ } from "./src/broker/broker.js";

dns.setServers(["8.8.8.8", "0.0.0.0"]);
connectDB();
connectToRabbitMQ()

app.listen(3004, () => {
    console.log("payment Server is running on port 3004");
});
