import "dotenv/config";
import { app } from "./src/app.js";
import { connectDB } from "./src/db/db.js";
import dns from "dns";

// Windows pe MongoDB Atlas SRV query issue fix karne ke liye
dns.setServers(["8.8.8.8", "1.1.1.1"]);

connectDB();

const PORT = process.env.PORT || 3002;

app.listen(PORT, () => {
    console.log(`Cart Server is running on port ${PORT}`);
});
