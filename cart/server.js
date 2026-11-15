import { app } from "./src/app.js";
import dotenv from "dotenv";
import { connectDB } from "./src/db/db.js";

dotenv.config();

connectDB();

app.listen(3002, () => {
    console.log("Cart Server is running on port 3002");
});
