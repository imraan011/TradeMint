import "dotenv/config";
import dns from "dns";
import { app } from "./src/app.js";
import { connectDB } from "./src/db/db.js";

// MongoDB Atlas DNS fallback
dns.setServers(["8.8.8.8", "0.0.0.0"]);

connectDB();

app.listen(process.env.PORT, async () => {
    console.log("ai-buddy Server running on port  3005");
});
