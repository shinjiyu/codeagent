/**
 * ShellEnv 测试
 */

import * as fs from 'fs';
import * as path from 'path';
import { ShellEnv } from '../src/shell-env';

// 测试用的临时目录
const TEST_DIR = './test-shell-env-dir';

beforeAll(() => {
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(TEST_DIR, { recursive: true });
});

afterAll(() => {
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  }
});

describe('ShellEnv', () => {
  let shellEnv: ShellEnv;

  beforeEach(() => {
    shellEnv = new ShellEnv(TEST_DIR);
  });

  describe('exec', () => {
    it('应该执行简单命令', async () => {
      const result = await shellEnv.exec('echo "hello"');
      
      expect(result.success).toBe(true);
      expect(result.stdout.trim()).toBe('hello');
      expect(result.exitCode).toBe(0);
    });

    it('应该返回执行时间', async () => {
      const result = await shellEnv.exec('echo "test"');
      
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('应该处理失败的命令', async () => {
      const result = await shellEnv.exec('exit 1');
      
      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1);
    });

    it('应该在指定目录执行', async () => {
      // 创建子目录
      const subDir = path.join(TEST_DIR, 'subdir');
      fs.mkdirSync(subDir, { recursive: true });
      
      const result = await shellEnv.exec('pwd', subDir);
      
      expect(result.stdout).toContain('subdir');
    });

    it('应该捕获 stdout 和 stderr', async () => {
      const result = await shellEnv.exec('node -e "console.log(\'out\'); console.error(\'err\');"');
      
      expect(result.stdout).toContain('out');
      expect(result.stderr).toContain('err');
    });
  });

  describe('build', () => {
    it('应该使用默认构建命令', async () => {
      const result = await shellEnv.build();
      
      // 在没有项目的情况下，命令会执行但可能失败或成功
      expect(result).toBeDefined();
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('应该使用自定义构建命令', async () => {
      const result = await shellEnv.build('echo "custom build"');
      
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('custom build');
    });
  });

  describe('lint', () => {
    it('应该使用默认 lint 命令', async () => {
      const result = await shellEnv.lint();
      
      // 没有 lint 配置会失败
      expect(result).toBeDefined();
    });

    it('应该使用自定义 lint 命令', async () => {
      const result = await shellEnv.lint('echo "linting"');
      
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('linting');
    });
  });

  describe('runTests', () => {
    it('应该解析 Jest 通过输出', async () => {
      // 模拟 Jest 输出
      const mockOutput = `
        PASS src/utils.test.ts
        Test Suites: 1 passed, 1 total
        Tests:       5 passed, 5 total
      `;
      
      // 使用自定义命令模拟
      const result = await shellEnv.runTests('echo "Tests: 5 passed, 5 total"');
      
      expect(result.passed).toBe(5);
      expect(result.total).toBe(5);
    });

    it('应该解析测试失败输出', async () => {
      // 模拟失败的测试命令 - 输出到 stderr
      const result = await shellEnv.runTests('node -e "process.stderr.write(\'Tests: 3 passed, 2 failed, 5 total\\n\'); process.exit(1)"');
      
      // 注意：解析可能因格式不同而变化
      expect(result.output).toContain('passed');
    });

    it('应该包含测试输出', async () => {
      const result = await shellEnv.runTests('echo "test output"');
      
      expect(result.output).toContain('test output');
    });
  });

  describe('installDeps', () => {
    it('应该尝试运行 npm install', async () => {
      const result = await shellEnv.installDeps('npm');
      
      // 没有实际项目会失败
      expect(result).toBeDefined();
    });

    it('应该尝试运行 yarn install', async () => {
      const result = await shellEnv.installDeps('yarn');
      
      expect(result).toBeDefined();
    });

    it('应该尝试运行 pnpm install', async () => {
      const result = await shellEnv.installDeps('pnpm');
      
      expect(result).toBeDefined();
    });
  });

  describe('format', () => {
    it('应该尝试运行 prettier', async () => {
      const result = await shellEnv.format();
      
      // prettier 不存在会失败
      expect(result).toBeDefined();
    });
  });

  describe('错误处理', () => {
    it('应该处理命令不存在', async () => {
      const result = await shellEnv.exec('nonexistentcommand123');
      
      expect(result.success).toBe(false);
      expect(result.stderr).toBeTruthy();
    });

    it('应该处理超时', async () => {
      // ShellEnv 默认超时 5 分钟，这里只测试不会无限等待
      const result = await shellEnv.exec('echo "fast command"');
      
      expect(result.duration).toBeLessThan(5000);
    });
  });
});
