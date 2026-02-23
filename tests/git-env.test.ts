/**
 * GitEnv 测试
 */

import * as fs from 'fs';
import * as path from 'path';
import { GitEnv } from '../src/git-env';
import { execSync } from 'child_process';

// 测试用的临时目录
const TEST_REPO_PATH = './test-git-env-repo';

// 创建测试 Git 仓库
function createTestRepo(): void {
  if (fs.existsSync(TEST_REPO_PATH)) {
    fs.rmSync(TEST_REPO_PATH, { recursive: true, force: true });
  }
  fs.mkdirSync(TEST_REPO_PATH, { recursive: true });
  
  // 初始化 Git 仓库
  execSync('git init', { cwd: TEST_REPO_PATH });
  execSync('git config user.email "test@test.com"', { cwd: TEST_REPO_PATH });
  execSync('git config user.name "Test"', { cwd: TEST_REPO_PATH });
  
  // 创建一些文件
  fs.writeFileSync(path.join(TEST_REPO_PATH, 'package.json'), JSON.stringify({
    name: 'test-repo',
    version: '1.0.0',
    dependencies: { jest: '^29.0.0' },
    devDependencies: { typescript: '^5.0.0' }
  }, null, 2));
  
  fs.mkdirSync(path.join(TEST_REPO_PATH, 'src'), { recursive: true });
  fs.writeFileSync(path.join(TEST_REPO_PATH, 'src/index.ts'), 'export const x = 1;');
  
  fs.mkdirSync(path.join(TEST_REPO_PATH, 'tests'), { recursive: true });
  fs.writeFileSync(path.join(TEST_REPO_PATH, 'tests/test.ts'), 'test("test", () => {});');
  
  fs.writeFileSync(path.join(TEST_REPO_PATH, 'tsconfig.json'), '{}');
  
  // 初始提交
  execSync('git add .', { cwd: TEST_REPO_PATH });
  execSync('git commit -m "Initial commit"', { cwd: TEST_REPO_PATH });
}

// 清理
function cleanupTestRepo(): void {
  if (fs.existsSync(TEST_REPO_PATH)) {
    fs.rmSync(TEST_REPO_PATH, { recursive: true, force: true });
  }
}

beforeAll(() => {
  createTestRepo();
});

afterAll(() => {
  cleanupTestRepo();
});

describe('GitEnv', () => {
  let gitEnv: GitEnv;

  beforeEach(() => {
    gitEnv = new GitEnv();
  });

  describe('open', () => {
    it('应该打开已存在的仓库', async () => {
      const repo = await gitEnv.open(TEST_REPO_PATH);
      
      expect(repo.path).toBe(TEST_REPO_PATH);
    });

    it('应该获取当前分支', async () => {
      await gitEnv.open(TEST_REPO_PATH);
      const branch = await gitEnv.getCurrentBranch();
      
      expect(branch).toBe('master'); // Git 默认分支
    });
  });

  describe('getStatus', () => {
    it('应该获取空状态（无修改）', async () => {
      await gitEnv.open(TEST_REPO_PATH);
      const status = await gitEnv.getStatus();
      
      expect(status.modified).toHaveLength(0);
      expect(status.created).toHaveLength(0);
    });

    it('应该检测到修改的文件', async () => {
      await gitEnv.open(TEST_REPO_PATH);
      
      // 修改文件
      fs.writeFileSync(
        path.join(TEST_REPO_PATH, 'src/index.ts'),
        'export const x = 2;'
      );
      
      const status = await gitEnv.getStatus();
      expect(status.modified.length).toBeGreaterThan(0);
    });

    it('应该检测到新文件', async () => {
      await gitEnv.open(TEST_REPO_PATH);
      
      // 创建新文件
      fs.writeFileSync(
        path.join(TEST_REPO_PATH, 'new-file.ts'),
        'export const y = 1;'
      );
      
      const status = await gitEnv.getStatus();
      expect(status.untracked.length).toBeGreaterThan(0);
    });
  });

  describe('createBranch', () => {
    it('应该创建新分支', async () => {
      await gitEnv.open(TEST_REPO_PATH);
      await gitEnv.createBranch('test-branch');
      
      const branch = await gitEnv.getCurrentBranch();
      expect(branch).toBe('test-branch');
    });
  });

  describe('add 和 commit', () => {
    it('应该添加并提交文件', async () => {
      await gitEnv.open(TEST_REPO_PATH);
      
      // 创建新文件
      fs.writeFileSync(
        path.join(TEST_REPO_PATH, 'commit-test.ts'),
        'export const z = 1;'
      );
      
      await gitEnv.add('commit-test.ts');
      const commitHash = await gitEnv.commit('Test commit');
      
      expect(commitHash).toBeTruthy();
    });
  });

  describe('analyzeStructure', () => {
    it('应该分析项目结构', async () => {
      await gitEnv.open(TEST_REPO_PATH);
      const structure = await gitEnv.analyzeStructure();
      
      expect(structure.root).toBe(TEST_REPO_PATH);
      expect(structure.srcDir).toContain('src');
      expect(structure.testDir).toContain('tests');
      // configFile 和 packageFile 可能是任一个配置文件
      expect(structure.configFile || structure.packageFile).toBeTruthy();
    });
  });

  describe('detectTechStack', () => {
    it('应该检测 TypeScript 项目', async () => {
      await gitEnv.open(TEST_REPO_PATH);
      const techStack = await gitEnv.detectTechStack();
      
      expect(techStack.language).toBe('typescript');
      expect(techStack.testFramework).toBe('jest');
    });
  });

  describe('getFileContent 和 writeFile', () => {
    it('应该读取文件内容', async () => {
      await gitEnv.open(TEST_REPO_PATH);
      const content = gitEnv.getFileContent('src/index.ts');
      
      expect(content).toContain('export const');
    });

    it('应该写入文件内容', async () => {
      await gitEnv.open(TEST_REPO_PATH);
      
      gitEnv.writeFile('src/new.ts', 'export const newFile = true;');
      
      const content = gitEnv.getFileContent('src/new.ts');
      expect(content).toBe('export const newFile = true;');
    });
  });

  describe('getDiff', () => {
    it('应该获取差异', async () => {
      await gitEnv.open(TEST_REPO_PATH);
      
      // 修改文件
      fs.writeFileSync(
        path.join(TEST_REPO_PATH, 'src/index.ts'),
        'export const x = 999;'
      );
      
      const diff = await gitEnv.getDiff('src/index.ts');
      expect(diff).toContain('x = 999');
    });
  });

  describe('resetHard', () => {
    it('应该回滚所有更改', async () => {
      await gitEnv.open(TEST_REPO_PATH);
      
      // 修改文件
      fs.writeFileSync(
        path.join(TEST_REPO_PATH, 'src/index.ts'),
        'export const x = 999;'
      );
      
      // 验证修改
      let content = gitEnv.getFileContent('src/index.ts');
      expect(content).toContain('999');
      
      // 回滚
      await gitEnv.resetHard();
      
      // 验证回滚
      content = gitEnv.getFileContent('src/index.ts');
      expect(content).not.toContain('999');
    });
  });
});
