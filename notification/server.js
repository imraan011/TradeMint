import "dotenv/config";
import dns from "dns";
import { app } from "./src/app.js";

dns.setServers(["8.8.8.8", "1.1.1.1"]);

app.listen(3006, () => {
    console.log("Server is running on port 3006");
});
