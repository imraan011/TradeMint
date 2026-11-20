import mongoose from "mongoose";

export const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI);
        console.log("connected to MongoDB payment database");
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};
