import "dotenv/config";
import { app } from "./src/app.js";
import { connectToDatabase } from "./src/db/db.js";
import dns from "dns";
dns.setServers(["8.8.8.8", "1.1.1.1"]);

connectToDatabase();

app.listen(3000, () => {
    console.log("Auth Server is running on port 3000");
});
