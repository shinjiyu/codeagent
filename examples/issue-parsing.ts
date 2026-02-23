/**
 * SWE-Agent-Node Issue 解析示例
 * 
 * 演示如何使用 IssueParser 解析问题
 */

import { IssueParser } from '../src';
import type { Issue } from '../src/types';

async function demonstrateIssueParsing() {
  console.log('=== SWE-Agent-Node Issue 解析示例 ===\n');

  const parser = new IssueParser();

  // 示例 1: Bug 报告
  console.log('📋 示例 1: Bug 报告');
  const bugIssue: Issue = {
    id: 'bug-001',
    title: 'TypeError: Cannot read property "name" of undefined',
    body: `
## Description
Users are experiencing a TypeError when trying to access the profile page.

## Stack Trace
\`\`\`
TypeError: Cannot read property "name" of undefined
    at UserProfile.render (src/components/UserProfile.tsx:42:10)
    at finishClassComponent (node_modules/react-dom/cjs/react-dom-server.node.development.js:8542:31)
    at renderClassComponentToString (node_modules/react-dom/cjs/react-dom-server.node.development.js:8497:24)
\`\`\`

## Steps to Reproduce
1. Navigate to /profile
2. Click on "Edit Profile"
3. Error occurs

## Affected Files
- src/components/UserProfile.tsx
- src/services/userService.ts
    `,
    labels: ['bug', 'priority-high'],
  };

  const bugResult = parser.parse(bugIssue);
  
  console.log(`   类型: ${bugResult.parsed?.type}`);
  console.log(`   严重程度: ${bugResult.parsed?.severity}`);
  console.log(`   提及文件: ${bugResult.parsed?.mentionedFiles.slice(0, 3).join(', ')}`);
  console.log(`   错误堆栈: ${bugResult.parsed?.errorStack?.length} 帧`);
  console.log(`   置信度: ${((bugResult.parsed?.confidence || 0) * 100).toFixed(0)}%`);
  console.log();

  // 示例 2: 功能请求
  console.log('📋 示例 2: 功能请求');
  const featureIssue: Issue = {
    id: 'feature-001',
    title: 'Add dark mode support',
    body: `
## Feature Request
Please add dark mode support to the application.

## Requirements
- Toggle between light and dark themes
- Persist user preference
- Apply to all UI components

## Suggested Implementation
Update the ThemeContext and add CSS variables for dark mode colors.
    `,
    labels: ['enhancement', 'ui'],
  };

  const featureResult = parser.parse(featureIssue);
  
  console.log(`   类型: ${featureResult.parsed?.type}`);
  console.log(`   严重程度: ${featureResult.parsed?.severity}`);
  console.log(`   推测区域: ${featureResult.parsed?.suspectedAreas.join(', ')}`);
  console.log();

  // 示例 3: Python 错误
  console.log('📋 示例 3: Python 错误');
  const pythonIssue: Issue = {
    id: 'python-001',
    title: 'ImportError in API module',
    body: `
\`\`\`
Traceback (most recent call last):
  File "app.py", line 15, in <module>
    from api.routes import bp
  File "/app/api/routes.py", line 8, in <module>
    from .auth import authenticate
  File "/app/api/auth.py", line 12, in <module>
    from utils.tokens import verify_token
ImportError: cannot import name 'verify_token' from 'utils.tokens'
\`\`\`
    `,
    labels: ['bug'],
  };

  const pythonResult = parser.parse(pythonIssue);
  
  console.log(`   类型: ${pythonResult.parsed?.type}`);
  console.log(`   错误堆栈: ${pythonResult.parsed?.errorStack?.length} 帧`);
  if (pythonResult.parsed?.errorStack && pythonResult.parsed.errorStack.length > 0) {
    console.log(`   第一帧: ${pythonResult.parsed.errorStack[0].file}`);
  }
  console.log();

  // 示例 4: 解析 GitHub URL
  console.log('📋 示例 4: 解析 GitHub URL');
  const url = 'https://github.com/facebook/react/issues/24535';
  const urlResult = parser.parseGitHubUrl(url);
  
  if (urlResult) {
    console.log(`   URL: ${url}`);
    console.log(`   Owner: ${urlResult.owner}`);
    console.log(`   Repo: ${urlResult.repo}`);
    console.log(`   Issue #: ${urlResult.number}`);
  }
  console.log();

  // 示例 5: 使用解析结果指导修复
  console.log('📋 示例 5: 使用解析结果');
  console.log(`
   解析结果可用于:

   1. 问题类型检测
      - 自动分配优先级
      - 路由到正确的团队

   2. 错误堆栈分析
      - 定位问题代码位置
      - 确定修复范围

   3. 文件/函数提取
      - 指导代码搜索
      - 缩小分析范围

   4. 区域推断
      - 预判涉及模块
      - 优化搜索策略

   5. 置信度评估
      - 高置信度 → 直接修复
      - 低置信度 → 需要更多信息
  `);

  console.log('\n✅ 示例完成!');
  
  console.log('\n📖 完整使用方式:');
  console.log(`
    import { IssueParser } from 'swe-agent-node';

    const parser = new IssueParser();
    const parsed = parser.parse({
      id: '123',
      title: 'Bug title',
      body: 'Bug description with stack trace...',
      labels: ['bug']
    });

    // 使用解析结果指导修复
    if (parsed.parsed?.type === 'bug' && parsed.parsed.confidence > 0.5) {
      // 高置信度 bug，可以开始修复
      const files = parsed.parsed.mentionedFiles;
      const stack = parsed.parsed.errorStack;
      // ...
    }
  `);
}

// 运行示例
demonstrateIssueParsing().catch(console.error);
