/** @type {import('jest').Config} */
const config = {
  rootDir: '.',
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/lib/**/*.test.ts',
    '<rootDir>/lib/**/*.test.tsx',
    '<rootDir>/app/**/*.test.ts',
    '<rootDir>/app/**/*.test.tsx',
  ],
  transform: {
    '^.+\\.(t|j)sx?$': [
      'ts-jest',
      {
        tsconfig: {
          // Reuse the Next-aware tsconfig (jsx, esnext, paths),
          // but disable emit. We use ts-jest's isolatedModules so
          // we don't need a full typecheck pass for tests.
          jsx: 'react-jsx',
          esModuleInterop: true,
          module: 'commonjs',
          moduleResolution: 'node',
          target: 'es2022',
          strict: true,
          skipLibCheck: true,
          isolatedModules: true,
          paths: {
            '@/*': ['./*'],
          },
          baseUrl: '.',
        },
      },
    ],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  setupFiles: ['<rootDir>/jest.setup.ts'],
};

module.exports = config;
