import { app } from "./src/app.js";
import { connectDB } from "./src/db/db.js";
import "dotenv/config";
import dns from "dns";

dns.setServers(["8.8.8.8", "1.1.1.1"]);

connectDB();

app.listen(3003, () => {
    console.log("Orders Server is running on port 3003");
});
