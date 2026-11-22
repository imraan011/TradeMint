/**
 * Isolated in-memory DB and test environment setup.
 * Uses MongoMemoryServer so real DB or main credentials are never touched.
 */

import "dotenv/config";
import { beforeAll, afterAll, afterEach, jest } from "@jest/globals";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test_isolated_jwt_secret_12345";
process.env.RAZORPAY_KEY_ID = "rzp_test_dummy_key_id";
process.env.RAZORPAY_KEY_SECRET = "test_dummy_key_secret_123456789";

jest.setTimeout(60000);

let mongoServer;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create({
        binary: { version: "6.0.14" },
    });
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
}, 60000);

afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) {
        await mongoServer.stop();
    }
});

afterEach(async () => {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
        await collections[key].deleteMany({});
    }
});
