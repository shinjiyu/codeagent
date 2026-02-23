/**
 * CodeSearch 测试
 */

import * as fs from 'fs';
import * as path from 'path';
import { CodeSearch } from '../src/code-search';

// 测试用的临时目录
const TEST_REPO_PATH = './test-code-search-repo';

// 创建测试文件
function createTestFile(filename: string, content: string): void {
  const filePath = path.join(TEST_REPO_PATH, filename);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, content);
}

// 测试前后清理
beforeAll(() => {
  if (fs.existsSync(TEST_REPO_PATH)) {
    fs.rmSync(TEST_REPO_PATH, { recursive: true, force: true });
  }
  fs.mkdirSync(TEST_REPO_PATH, { recursive: true });
});

afterAll(() => {
  if (fs.existsSync(TEST_REPO_PATH)) {
    fs.rmSync(TEST_REPO_PATH, { recursive: true, force: true });
  }
});

describe('CodeSearch', () => {
  let searcher: CodeSearch;

  beforeEach(() => {
    searcher = new CodeSearch(TEST_REPO_PATH);
  });

  describe('searchByKeywords', () => {
    beforeEach(() => {
      createTestFile('src/utils.ts', `
        export function greet(name: string): string {
          return \`Hello, \${name}!\`;
        }
        
        export function farewell(name: string): string {
          return \`Goodbye, \${name}!\`;
        }
      `);

      createTestFile('src/main.ts', `
        import { greet } from './utils';
        
        const userName = 'World';
        console.log(greet(userName));
      `);
    });

    it('应该搜索到包含关键词的文件', async () => {
      const results = await searcher.searchByKeywords(['greet']);
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].file).toContain('utils.ts');
      expect(results[0].context).toContain('greet');
    });

    it('应该返回匹配的行号', async () => {
      const results = await searcher.searchByKeywords(['farewell']);
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].line).toBeGreaterThan(0);
    });

    it('应该限制结果数量', async () => {
      // 创建多个包含关键词的文件
      for (let i = 0; i < 30; i++) {
        createTestFile(`src/file${i}.ts`, `export const test${i} = "test";`);
      }

      const results = await searcher.searchByKeywords(['test'], { maxResults: 10 });
      expect(results.length).toBeLessThanOrEqual(10);
    });

    it('应该忽略 node_modules 目录', async () => {
      createTestFile('node_modules/package/index.js', `
        export function greet() { return 'from node_modules'; }
      `);

      const results = await searcher.searchByKeywords(['greet']);
      
      // 不应该包含 node_modules 中的文件
      expect(results.every(r => !r.file.includes('node_modules'))).toBe(true);
    });
  });

  describe('searchFunction', () => {
    beforeEach(() => {
      createTestFile('src/helpers.ts', `
        function helperFunction() {
          return 'helper';
        }
        
        const arrowFunction = () => 'arrow';
        
        const asyncFunc = async () => {
          return await Promise.resolve('async');
        };
        
        export class MyClass {
          myMethod() {
            return 'method';
          }
        }
      `);
    });

    it('应该搜索到函数声明', async () => {
      const results = await searcher.searchFunction('helperFunction');
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].context).toContain('function helperFunction');
    });

    it('应该搜索到箭头函数', async () => {
      const results = await searcher.searchFunction('arrowFunction');
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].context).toContain('arrowFunction');
    });
  });

  describe('searchClass', () => {
    beforeEach(() => {
      createTestFile('src/models.ts', `
        export class User {
          constructor(public name: string) {}
        }
        
        export class AdminUser extends User {
          constructor(name: string, public role: string) {
            super(name);
          }
        }
      `);
    });

    it('应该搜索到类定义', async () => {
      const results = await searcher.searchClass('User');
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].context).toContain('class User');
    });

    it('应该搜索到继承的类', async () => {
      const results = await searcher.searchClass('AdminUser');
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].context).toContain('class AdminUser extends User');
    });
  });

  describe('searchError', () => {
    beforeEach(() => {
      createTestFile('src/errors.ts', `
        export function validate(value: unknown) {
          if (!value) {
            throw new Error('Invalid value provided');
          }
        }
        
        export function checkAuth(user: unknown) {
          if (!user) {
            throw new Error('User not authenticated');
          }
        }
      `);
    });

    it('应该搜索到错误信息', async () => {
      const results = await searcher.searchError('Invalid value');
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].context).toContain('Invalid value');
    });

    it('应该搜索到认证错误', async () => {
      const results = await searcher.searchError('not authenticated');
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].context).toContain('not authenticated');
    });
  });

  describe('getSnippet', () => {
    beforeEach(() => {
      createTestFile('src/code.ts', `
        // Line 1
        // Line 2
        // Line 3
        export function target() {
          return 'target';
        }
        // Line 7
        // Line 8
        // Line 9
      `);
    });

    it('应该获取指定范围的代码片段', async () => {
      const snippet = await searcher.getSnippet('src/code.ts', 4, 6);
      
      expect(snippet.startLine).toBe(4);
      expect(snippet.endLine).toBe(6);
      expect(snippet.content).toContain('target');
    });

    it('应该正确检测语言', async () => {
      const snippet = await searcher.getSnippet('src/code.ts', 1, 2);
      expect(snippet.language).toBe('typescript');
    });

    it('应该返回相对路径', async () => {
      const snippet = await searcher.getSnippet('src/code.ts', 1, 2);
      expect(snippet.file).not.toContain(TEST_REPO_PATH);
    });
  });

  describe('findFiles', () => {
    it('应该根据模式查找文件', async () => {
      // 使用唯一的目录名避免冲突
      const uniqueDir = `findfiles-test-${Date.now()}`;
      createTestFile(`${uniqueDir}/a.ts`, '');
      createTestFile(`${uniqueDir}/b.ts`, '');
      
      const files = await searcher.findFiles(`${uniqueDir}/*.ts`);
      
      expect(files.length).toBe(2);
      expect(files.every(f => f.endsWith('.ts'))).toBe(true);
    });

    it('应该支持 glob 模式', async () => {
      const uniqueDir = `glob-test-${Date.now()}`;
      createTestFile(`${uniqueDir}/a.test.ts`, '');
      createTestFile(`${uniqueDir}/b.ts`, '');
      
      const files = await searcher.findFiles(`${uniqueDir}/*.test.ts`);
      
      expect(files.length).toBe(1);
      expect(files[0]).toContain('a.test.ts');
    });
  });

  describe('语言检测', () => {
    it('应该检测 TypeScript', async () => {
      createTestFile('test.ts', 'const x = 1;');
      const snippet = await searcher.getSnippet('test.ts', 1, 1);
      expect(snippet.language).toBe('typescript');
    });

    it('应该检测 JavaScript', async () => {
      createTestFile('test.js', 'const x = 1;');
      const snippet = await searcher.getSnippet('test.js', 1, 1);
      expect(snippet.language).toBe('javascript');
    });

    it('应该检测 Python', async () => {
      createTestFile('test.py', 'x = 1');
      const snippet = await searcher.getSnippet('test.py', 1, 1);
      expect(snippet.language).toBe('python');
    });
  });
});
