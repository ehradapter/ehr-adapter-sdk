/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src", "<rootDir>/tests"],
  testMatch: [
    "**/__tests__/**/*.+(ts|tsx|js)",
    "**/*.(test|spec).+(ts|tsx|js)",
  ],
  transform: {
    "^.+\\.(ts|tsx)$": "ts-jest",
  },
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.d.ts",
    "!src/**/*.test.{ts,tsx}",
    "!src/**/*.spec.{ts,tsx}",
    "!src/**/index.ts",
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html"],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  // setupFilesAfterEnv: ['<rootDir>/tests/test-runner.ts'], // Not needed for MIT version
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@/types/(.*)$": "<rootDir>/src/types/$1",
    "^@/core/(.*)$": "<rootDir>/src/core/$1",
    "^@/auth/(.*)$": "<rootDir>/src/auth/$1",
    "^@/security/(.*)$": "<rootDir>/src/security/$1",
    "^@/vendors/(.*)$": "<rootDir>/src/vendors/$1",
    "^@/plugins/(.*)$": "<rootDir>/src/plugins/$1",
    "^@/logging/(.*)$": "<rootDir>/src/logging/$1",
    "^@/utils/(.*)$": "<rootDir>/src/utils/$1",
    "^@/config/(.*)$": "<rootDir>/src/config/$1",
  },
  testTimeout: 10000,
  verbose: true,
};
