/**
 * IssueParser 测试
 */

import { IssueParser } from '../src/issue-parser';
import type { Issue } from '../src/types';

describe('IssueParser', () => {
  let parser: IssueParser;

  beforeEach(() => {
    parser = new IssueParser();
  });

  describe('parse', () => {
    it('应该解析基本 Issue', () => {
      const issue: Issue = {
        id: 'test-1',
        title: 'Fix login bug',
        body: 'Users cannot login with valid credentials',
      };

      const result = parser.parse(issue);

      expect(result.parsed).toBeDefined();
      expect(result.parsed?.type).toBe('bug');
      expect(result.keywords).toContain('login');
    });

    it('应该检测 bug 类型', () => {
      const issue: Issue = {
        id: 'test-2',
        title: 'App crashes on startup',
        body: 'The application crashes immediately after launch',
      };

      const result = parser.parse(issue);
      expect(result.parsed?.type).toBe('bug');
    });

    it('应该检测 feature 类型', () => {
      const issue: Issue = {
        id: 'test-3',
        title: 'Add dark mode support',
        body: 'Please implement dark mode for the application',
      };

      const result = parser.parse(issue);
      expect(result.parsed?.type).toBe('feature');
    });

    it('应该检测 enhancement 类型', () => {
      const issue: Issue = {
        id: 'test-4',
        title: 'Improve performance',
        body: 'Optimize the database queries for better performance',
      };

      const result = parser.parse(issue);
      expect(result.parsed?.type).toBe('enhancement');
    });

    it('应该使用 labels 检测类型', () => {
      const issue: Issue = {
        id: 'test-5',
        title: 'Update something',
        body: 'Update the component',
        labels: ['bug', 'priority'],
      };

      const result = parser.parse(issue);
      expect(result.parsed?.type).toBe('bug');
    });
  });

  describe('detectSeverity', () => {
    it('应该检测 critical 严重程度', () => {
      const issue: Issue = {
        id: 'test-6',
        title: 'Critical security vulnerability',
        body: 'This is a critical security issue',
      };

      const result = parser.parse(issue);
      expect(result.parsed?.severity).toBe('critical');
    });

    it('应该检测 high 严重程度', () => {
      const issue: Issue = {
        id: 'test-7',
        title: 'Important bug',
        body: 'This is blocking the release',
      };

      const result = parser.parse(issue);
      expect(result.parsed?.severity).toBe('high');
    });
  });

  describe('extractErrorStack', () => {
    it('应该提取 JavaScript 错误堆栈', () => {
      const issue: Issue = {
        id: 'test-8',
        title: 'TypeError',
        body: `
Error: Something went wrong
    at login (src/auth.ts:42:10)
    at handleClick (src/components/Button.tsx:15:5)
    at onClick (src/App.tsx:100:8)
        `,
      };

      const result = parser.parse(issue);
      
      expect(result.parsed?.errorStack).toBeDefined();
      expect(result.parsed?.errorStack?.length).toBeGreaterThan(0);
      expect(result.parsed?.errorStack?.[0].file).toContain('auth.ts');
    });

    it('应该提取 Python 错误堆栈', () => {
      const issue: Issue = {
        id: 'test-9',
        title: 'Python Error',
        body: `
Traceback (most recent call last):
  File "app.py", line 42, in main
  File "utils.py", line 15, in process
        `,
      };

      const result = parser.parse(issue);
      
      expect(result.parsed?.errorStack).toBeDefined();
      expect(result.parsed?.errorStack?.some(f => f.file.includes('app.py'))).toBe(true);
    });
  });

  describe('extractFiles', () => {
    it('应该提取文件路径', () => {
      const issue: Issue = {
        id: 'test-10',
        title: 'Bug in auth',
        body: 'The bug is in src/auth/login.ts and src/utils/helpers.ts',
      };

      const result = parser.parse(issue);
      
      expect(result.parsed?.mentionedFiles).toContain('src/auth/login.ts');
      expect(result.parsed?.mentionedFiles).toContain('src/utils/helpers.ts');
    });

    it('应该提取配置文件', () => {
      const issue: Issue = {
        id: 'test-11',
        title: 'Config issue',
        body: 'Check package.json and tsconfig.json',
      };

      const result = parser.parse(issue);
      
      expect(result.parsed?.mentionedFiles).toContain('package.json');
      expect(result.parsed?.mentionedFiles).toContain('tsconfig.json');
    });
  });

  describe('extractFunctions', () => {
    it('应该提取函数名', () => {
      const issue: Issue = {
        id: 'test-12',
        title: 'Function error',
        body: 'The handleLogin() and validateUser() functions are broken',
      };

      const result = parser.parse(issue);
      
      expect(result.parsed?.mentionedFunctions).toContain('handleLogin');
      expect(result.parsed?.mentionedFunctions).toContain('validateUser');
    });
  });

  describe('extractClasses', () => {
    it('应该提取类名', () => {
      const issue: Issue = {
        id: 'test-13',
        title: 'Class issue',
        body: 'The UserService and AuthService classes need fixes',
      };

      const result = parser.parse(issue);
      
      expect(result.parsed?.mentionedClasses).toContain('UserService');
      expect(result.parsed?.mentionedClasses).toContain('AuthService');
    });
  });

  describe('extractCodeSnippets', () => {
    it('应该提取代码块', () => {
      const issue: Issue = {
        id: 'test-14',
        title: 'Code issue',
        body: `
Here is the problematic code:
\`\`\`typescript
function broken() {
  return null;
}
\`\`\`
        `,
      };

      const result = parser.parse(issue);
      
      expect(result.parsed?.codeSnippets.length).toBeGreaterThan(0);
      expect(result.parsed?.codeSnippets[0]).toContain('broken');
    });

    it('应该提取行内代码', () => {
      const issue: Issue = {
        id: 'test-15',
        title: 'Inline code',
        body: 'The issue is in `src/index.ts` at line 42',
      };

      const result = parser.parse(issue);
      
      expect(result.parsed?.codeSnippets).toContain('src/index.ts');
    });
  });

  describe('inferSuspectedAreas', () => {
    it('应该推断 auth 区域', () => {
      const issue: Issue = {
        id: 'test-16',
        title: 'Login issue',
        body: 'Users cannot login to the system',
      };

      const result = parser.parse(issue);
      
      expect(result.parsed?.suspectedAreas).toContain('auth');
    });

    it('应该推断 api 区域', () => {
      const issue: Issue = {
        id: 'test-17',
        title: 'API error',
        body: 'The API endpoint returns wrong response',
      };

      const result = parser.parse(issue);
      
      expect(result.parsed?.suspectedAreas).toContain('api');
    });
  });

  describe('calculateConfidence', () => {
    it('有错误堆栈时应该有较高置信度', () => {
      const issue: Issue = {
        id: 'test-18',
        title: 'Error with stack trace',
        body: `
Error at login (src/auth.ts:42)
The bug is in the auth module.
        `,
        labels: ['bug'],
      };

      const result = parser.parse(issue);
      
      expect(result.parsed?.confidence).toBeGreaterThan(0.3);
    });

    it('信息不足时应该有较低置信度', () => {
      const issue: Issue = {
        id: 'test-19',
        title: 'Something',
        body: 'Not much info',
      };

      const result = parser.parse(issue);
      
      expect(result.parsed?.confidence).toBeLessThan(0.5);
    });
  });

  describe('parseGitHubUrl', () => {
    it('应该解析 GitHub Issue URL', () => {
      const result = parser.parseGitHubUrl('https://github.com/owner/repo/issues/123');
      
      expect(result).toEqual({
        owner: 'owner',
        repo: 'repo',
        number: 123,
      });
    });

    it('应该返回 null 对于无效 URL', () => {
      const result = parser.parseGitHubUrl('https://example.com/not-github');
      
      expect(result).toBeNull();
    });
  });

  describe('extractKeywords', () => {
    it('应该提取有意义的关键词', () => {
      const issue: Issue = {
        id: 'test-20',
        title: 'Fix TypeError in authentication module',
        body: 'When users try to login with invalid credentials, a TypeError occurs',
      };

      const result = parser.parse(issue);
      
      // 关键词从 body 中提取
      expect(result.keywords).toContain('typeerror');
      expect((result.keywords || []).length).toBeGreaterThan(0);
    });

    it('应该过滤停用词', () => {
      const issue: Issue = {
        id: 'test-21',
        title: 'The bug in the code',
        body: 'This is a bug that needs to be fixed',
      };

      const result = parser.parse(issue);
      
      expect(result.keywords).not.toContain('the');
      expect(result.keywords).not.toContain('this');
      expect(result.keywords).not.toContain('that');
    });
  });
});
