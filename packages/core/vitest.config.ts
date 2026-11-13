import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    // v8, not istanbul -- no extra babel instrumentation step needed, and
    // it's what tsup's own esbuild-based pipeline already builds against.
    // Only reported on request (`pnpm test:coverage`) -- not part of the
    // default `test` script, so a plain `pnpm test` run stays as fast as
    // before this was added.
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.d.ts'],
    },
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'jsdom',
          globals: true,
          include: ['./tests/unit/**/*.test.{ts,tsx}', './tests/sdk/**/*.test.{ts,tsx}', './tests/app/**/*.test.{ts,tsx}', './tests/contract/**/*.test.{ts,tsx}'],
          setupFiles: ['./tests/unit/vitest.setup.unit.ts'],
        },
      },
      {
        test: {
          name: 'emulator',
          environment: 'jsdom',
          globals: true,
          include: ['./tests/emulator/**/*.test.{ts,tsx}'],
        },
      },
      {
        test: {
          name: 'docs',
          environment: 'node',
          include: ['./tests/docs/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'bench',
          environment: 'jsdom',
          globals: true,
          include: ['./tests/bench/**/*.test.{ts,tsx}'],
          setupFiles: ['./tests/unit/vitest.setup.unit.ts'],
        },
      },
    ],
  },
})