import { app } from "./src/app.js";
import { connectDB } from "./src/db/db.js";
import "dotenv/config.js";
import dns from "dns";

dns.setServers(["8.8.8.8", "0.0.0.0"]);
connectDB();

app.listen(3004, () => {
    console.log("payment Server is running on port 3004");
});
