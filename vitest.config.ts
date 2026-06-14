import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // 默认 node 环境（适合纯 TS 工具/IPC 测试）
    // 组件测试文件可在文件顶部用 `// @vitest-environment jsdom` 覆盖
    environment: 'node',
    include: ['test/**/*.test.{ts,tsx}'],
    globals: false,
    coverage: {
      reporter: ['text', 'html'],
      include: ['electron/**/*.ts', 'src/components/common/**/*.tsx'],
    },
  },
});
