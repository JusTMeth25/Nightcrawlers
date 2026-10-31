import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'

const nodeOnly = ['src/game/systems/**/*.test.ts', 'src/data/**/*.test.ts']

export default defineConfig((env) =>
  mergeConfig(viteConfig(env), {
    test: {
      coverage: { provider: 'v8', include: ['src/**'] },
      projects: [
        {
          extends: true,
          test: { name: 'node', environment: 'node', include: nodeOnly },
        },
        {
          extends: true,
          test: {
            name: 'dom',
            environment: 'jsdom',
            include: ['src/**/*.test.{ts,tsx}'],
            exclude: nodeOnly,
            setupFiles: ['src/test-setup.ts'],
          },
        },
      ],
    },
  }),
)
