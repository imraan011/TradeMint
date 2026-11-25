import "dotenv/config";
import { app } from "./src/app.js";

app.listen(3006, () => {
    console.log("Server is running on port 3006");
});
