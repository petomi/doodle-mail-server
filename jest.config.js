module.exports = {
  "roots": [
    "<rootDir>"
  ],
  "testMatch": [
    "**/__tests__/**/*.+(ts|tsx)",
    "**/?(*.)+(spec|test).+(ts|tsx)"
  ],
  "transform": {
    "^.+\\.(ts|tsx)$": "ts-jest"
  },
  "testEnvironment": "node",
  "coveragePathIgnorePatterns": [
    "/node_modules/"
  ]
}
