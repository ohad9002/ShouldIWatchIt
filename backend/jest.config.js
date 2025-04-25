module.exports = {
    testEnvironment: "node",
    testMatch: ["**/__tests__/**/*.test.js"],
    coveragePathIgnorePatterns: ["/node_modules/"],
    collectCoverage: true,
    coverageThreshold: {
      global: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
  };
  