/** @type {import('jest').Config} */
module.exports = {
    testEnvironment: "node",
    transform: {},
    testMatch: ["**/__tests__/**/*.test.js"],
    setupFilesAfterEnv: ["<rootDir>/src/__tests__/setup.js"],
    verbose: true,
};
