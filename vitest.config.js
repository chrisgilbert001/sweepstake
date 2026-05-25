import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['server/**/*.test.js', 'client/**/*.test.js', 'client/**/*.test.jsx'],
    fileParallelism: false
  }
});
