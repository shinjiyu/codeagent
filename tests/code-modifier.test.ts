/**
 * CodeModifier 测试
 */

import * as fs from 'fs';
import * as path from 'path';
import { 
  CodeModifier, 
  createModificationFromSnippet, 
  createFileModification, 
  deleteFileModification 
} from '../src/code-modifier';
import type { CodeSnippet } from '../src/types';

// 测试用的临时目录
const TEST_REPO_PATH = './test-code-modifier-repo';

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

describe('CodeModifier', () => {
  let modifier: CodeModifier;

  beforeEach(() => {
    // 清理并重建测试目录
    if (fs.existsSync(TEST_REPO_PATH)) {
      fs.rmSync(TEST_REPO_PATH, { recursive: true, force: true });
    }
    fs.mkdirSync(TEST_REPO_PATH, { recursive: true });
    
    modifier = new CodeModifier(TEST_REPO_PATH);
  });

  describe('createFile (创建文件)', () => {
    it('应该创建新文件', async () => {
      const mod = createFileModification(
        'src/new-file.ts',
        'export const x = 1;',
        '创建新文件'
      );

      await modifier.applyModifications([mod]);

      const filePath = path.join(TEST_REPO_PATH, 'src/new-file.ts');
      expect(fs.existsSync(filePath)).toBe(true);
      expect(fs.readFileSync(filePath, 'utf-8')).toBe('export const x = 1;');
    });

    it('应该自动创建父目录', async () => {
      const mod = createFileModification(
        'deep/nested/dir/file.ts',
        'const x = 1;',
        '创建嵌套文件'
      );

      await modifier.applyModifications([mod]);

      const filePath = path.join(TEST_REPO_PATH, 'deep/nested/dir/file.ts');
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });

  describe('modifyFile (修改文件)', () => {
    beforeEach(() => {
      createTestFile('src/existing.ts', `
function greet(name: string) {
  return \`Hello, \${name}!\`;
}

function farewell(name: string) {
  return \`Goodbye, \${name}!\`;
}
      `.trim());
    });

    it('应该精确替换内容', async () => {
      const mod = {
        file: 'src/existing.ts',
        type: 'modify' as const,
        oldContent: "return `Hello, ${name}!`;",
        newContent: "return `Hi, ${name}!`;",
      };

      await modifier.applyModifications([mod]);

      const content = fs.readFileSync(
        path.join(TEST_REPO_PATH, 'src/existing.ts'),
        'utf-8'
      );
      expect(content).toContain('Hi, ${name}');
      expect(content).not.toContain('Hello, ${name}');
    });

    it('应该支持多行替换', async () => {
      const mod = {
        file: 'src/existing.ts',
        type: 'modify' as const,
        oldContent: `function greet(name: string) {
  return \`Hello, \${name}!\`;
}`,
        newContent: `function greet(name: string, greeting: string = 'Hello') {
  return \`\${greeting}, \${name}!\`;
}`,
      };

      await modifier.applyModifications([mod]);

      const content = fs.readFileSync(
        path.join(TEST_REPO_PATH, 'src/existing.ts'),
        'utf-8'
      );
      expect(content).toContain('greeting: string');
    });
  });

  describe('deleteFile (删除文件)', () => {
    beforeEach(() => {
      createTestFile('to-delete.ts', 'const x = 1;');
    });

    it('应该删除文件', async () => {
      const mod = deleteFileModification('to-delete.ts', 'const x = 1;');

      await modifier.applyModifications([mod]);

      const filePath = path.join(TEST_REPO_PATH, 'to-delete.ts');
      expect(fs.existsSync(filePath)).toBe(false);
    });
  });

  describe('rollback (回滚)', () => {
    beforeEach(() => {
      createTestFile('original.ts', 'const original = 1;');
    });

    it('应该回滚修改', async () => {
      const mod = {
        file: 'original.ts',
        type: 'modify' as const,
        oldContent: 'const original = 1;',
        newContent: 'const modified = 2;',
      };

      await modifier.applyModifications([mod]);

      // 验证修改已应用
      let content = fs.readFileSync(
        path.join(TEST_REPO_PATH, 'original.ts'),
        'utf-8'
      );
      expect(content).toBe('const modified = 2;');

      // 回滚
      await modifier.rollback();

      // 验证已恢复
      content = fs.readFileSync(
        path.join(TEST_REPO_PATH, 'original.ts'),
        'utf-8'
      );
      expect(content).toBe('const original = 1;');
    });

    it('应该回滚创建的文件', async () => {
      const mod = createFileModification('new-file.ts', 'const newContent = 1;');

      await modifier.applyModifications([mod]);

      const filePath = path.join(TEST_REPO_PATH, 'new-file.ts');
      expect(fs.existsSync(filePath)).toBe(true);

      await modifier.rollback();

      expect(fs.existsSync(filePath)).toBe(false);
    });
  });

  describe('preview (预览)', () => {
    it('应该生成预览而不修改文件', () => {
      const mods = [
        createFileModification('new.ts', 'const x = 1;'),
        {
          file: 'existing.ts',
          type: 'modify' as const,
          oldContent: 'old',
          newContent: 'new',
        },
        deleteFileModification('old.ts'),
      ];

      const preview = modifier.preview(mods);

      expect(preview).toContain('CREATE');
      expect(preview).toContain('MODIFY');
      expect(preview).toContain('DELETE');
      expect(preview).toContain('new.ts');
      expect(preview).toContain('existing.ts');
      expect(preview).toContain('old.ts');
    });
  });

  describe('getModifiedFiles', () => {
    it('应该返回修改的文件列表', async () => {
      createTestFile('file1.ts', 'const a = 1;');
      createTestFile('file2.ts', 'const b = 2;');

      const mods = [
        {
          file: 'file1.ts',
          type: 'modify' as const,
          oldContent: 'const a = 1;',
          newContent: 'const a = 2;',
        },
        createFileModification('file3.ts', 'const c = 3;'),
      ];

      await modifier.applyModifications(mods);

      const modifiedFiles = modifier.getModifiedFiles();
      expect(modifiedFiles.length).toBe(2);
    });
  });
});

describe('辅助函数', () => {
  describe('createModificationFromSnippet', () => {
    it('应该从代码片段创建修改', () => {
      const snippet: CodeSnippet = {
        file: 'test.ts',
        content: 'const x = 1;',
        startLine: 1,
        endLine: 1,
        language: 'typescript',
      };

      const mod = createModificationFromSnippet(
        snippet,
        'const x = 2;',
        '更新值'
      );

      expect(mod.file).toBe('test.ts');
      expect(mod.type).toBe('modify');
      expect(mod.oldContent).toBe('const x = 1;');
      expect(mod.newContent).toBe('const x = 2;');
      expect(mod.description).toBe('更新值');
    });
  });

  describe('createFileModification', () => {
    it('应该创建文件创建修改', () => {
      const mod = createFileModification(
        'new.ts',
        'export const x = 1;',
        '创建新文件'
      );

      expect(mod.file).toBe('new.ts');
      expect(mod.type).toBe('create');
      expect(mod.newContent).toBe('export const x = 1;');
    });
  });

  describe('deleteFileModification', () => {
    it('应该创建文件删除修改', () => {
      const mod = deleteFileModification(
        'old.ts',
        'const old = 1;',
        '删除旧文件'
      );

      expect(mod.file).toBe('old.ts');
      expect(mod.type).toBe('delete');
      expect(mod.oldContent).toBe('const old = 1;');
    });
  });
});
