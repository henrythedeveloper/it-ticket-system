// frontend/jest.config.js
module.exports = {
    preset: 'ts-jest', // Use ts-jest preset for TypeScript
    testEnvironment: 'jest-environment-jsdom', // Use jsdom environment for browser-like testing
    setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'], // Run setup file after env is set up
    moduleNameMapper: {
      // Handle CSS Modules (if you use them)
      '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
      // Handle static assets
      '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$': '<rootDir>/__mocks__/fileMock.js',
       // Setup path aliases if you use them in tsconfig.json (e.g., '@/*')
      '^@/(.*)$': '<rootDir>/src/$1',
    },
    transform: {
      '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: 'tsconfig.json' }], // Ensure it uses your tsconfig
    },
    // Automatically clear mock calls and instances between every test
    clearMocks: true,
    // Indicates whether the coverage information should be collected while executing the test
    collectCoverage: false, // Set to true if you want coverage reports
    // The directory where Jest should output its coverage files
    coverageDirectory: "coverage",
  };