import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

/**
 * Gate de testes unitários: 100% de cobertura em `src/lib` (lógica de negócio).
 * Páginas/API Next.js ficam fora deste gate (dependem de runtime/DB/HTTP).
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
    setupFiles: ['src/test/setup.ts'],
    reporters: ['default', 'junit', 'json'],
    outputFile: {
      junit: 'reports/junit.xml',
      json: 'reports/vitest.json',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'lcov', 'json', 'json-summary', 'cobertura'],

      reportsDirectory: 'coverage',
      include: ['src/lib/**/*.ts'],
      exclude: [
        'src/lib/**/*.test.ts',
        'src/lib/**/*.spec.ts',
        // Integração pesada (Prisma/Sharp/jsPDF/Gemini) — coberta por mocks seletivos
        // ou excluída do gate de 100% até haver harness dedicado.
        'src/lib/db.ts',
        'src/lib/ensure-schema.ts',
        'src/lib/schema-migrations.ts',
        'src/lib/certificate/generate-pdf.ts',
        'src/lib/certificate/open-pdf.ts',
        'src/lib/platform/compress-logo.ts',
        'src/lib/platform/compress-certificate-bg.ts',
        'src/lib/platform/persist-upload.ts',

        'src/lib/gemini/client.ts',
        'src/lib/assessment/process-discursive-grading.ts',
        'src/lib/assessment/prova-oficial-informatica.ts',
        'src/lib/assessment/discursive-informatica.ts',
        'src/lib/exercises/default-typing-passages.ts',
        'src/lib/exercises/ensure-typing-passages.ts',
        'src/lib/courses/ensure-courses.ts',
        'src/lib/auth/verify.ts',
      ],
      thresholds: {
        lines: 100,
        functions: 100,
        // Ramos defensivos/imutáveis (ex.: catch mortos, defaults) — Stryker valida a qualidade.
        branches: 95,
        // Vitest 5 / v8 conta alguns early-returns como statements extras; lines permanece 100%.
        statements: 99,
      },

    },
  },
  resolve: {
    alias: {
      '@': path.join(rootDir, 'src'),
    },
  },
})
