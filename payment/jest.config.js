export default {
    testEnvironment: "node",
    transform: {},
    setupFiles: ["<rootDir>/src/__tests__/env.setup.js"],
    setupFilesAfterEnv: ["<rootDir>/src/__tests__/setup.js"],
    testMatch: ["**/__tests__/**/*.test.js"],
    verbose: true,
};
