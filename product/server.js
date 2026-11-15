import "dotenv/config";
import { app } from "./src/app.js";
import { connectDB } from "./src/db/db.js";
import dns from "dns";
dns.setServers(["8.8.8.8", "1.1.1.1"]);

connectDB();

app.listen(3001, () => {
    console.log("Product Server is running on port 3001");
});
