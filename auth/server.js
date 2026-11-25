import "dotenv/config";
import { app } from "./src/app.js";
import { connectToDatabase } from "./src/db/db.js";
import dns from "dns";
import { connectToRabbitMQ } from "./src/broker/broker.js";
dns.setServers(["8.8.8.8", "1.1.1.1"]);

connectToDatabase();
connectToRabbitMQ()
app.listen(3000, () => {
    console.log("Auth Server is running on port 3000");
});
