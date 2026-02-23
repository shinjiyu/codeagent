/**
 * Tool Factory (Live-SWE-agent) - PoC
 * 
 * 演示如何在运行时动态创建新工具
 */

import * as vm from 'vm';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// 类型定义
// ============================================================================

interface ToolRequirement {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
    }>;
    required?: string[];
  };
  expectedOutput: string;
}

interface Tool {
  name: string;
  description: string;
  execute: (input: any) => Promise<any>;
  inputSchema: ToolRequirement['inputSchema'];
  createdAt: Date;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

interface SandboxConfig {
  timeout: number;
  maxMemory: number;
  allowedAPIs: string[];
}

// ============================================================================
// Code Generator
// ============================================================================

class ToolCodeGenerator {
  /**
   * 生成工具代码
   * 注意：实际实现中会调用 LLM 生成代码，这里使用模板
   */
  generateCode(requirement: ToolRequirement): string {
    // 根据需求类型生成代码
    if (requirement.description.toLowerCase().includes('fetch')) {
      return this.generateFetchTool(requirement);
    } else if (requirement.description.toLowerCase().includes('parse')) {
      return this.generateParseTool(requirement);
    } else if (requirement.description.toLowerCase().includes('calculate')) {
      return this.generateCalculateTool(requirement);
    } else {
      return this.generateGenericTool(requirement);
    }
  }

  private generateFetchTool(requirement: ToolRequirement): string {
    return `
async function execute(input) {
  const url = input.url;
  const options = input.options || {};
  
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: options.headers || {},
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  
  if (!response.ok) {
    throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
  }
  
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return await response.json();
  }
  return await response.text();
}
`;
  }

  private generateParseTool(requirement: ToolRequirement): string {
    return `
async function execute(input) {
  const text = input.text;
  const format = input.format || 'json';
  
  if (format === 'json') {
    return JSON.parse(text);
  } else if (format === 'csv') {
    const lines = text.split('\\n');
    const headers = lines[0].split(',');
    return lines.slice(1).map(line => {
      const values = line.split(',');
      const obj = {};
      headers.forEach((h, i) => obj[h.trim()] = values[i]?.trim());
      return obj;
    });
  } else {
    return { raw: text };
  }
}
`;
  }

  private generateCalculateTool(requirement: ToolRequirement): string {
    return `
async function execute(input) {
  const expression = input.expression;
  const variables = input.variables || {};
  
  // 安全的表达式计算（实际中应该用专门的数学库）
  let result;
  try {
    // 简单的数学运算
    const fn = new Function(...Object.keys(variables), \`return \${expression}\`);
    result = fn(...Object.values(variables));
  } catch (error) {
    throw new Error(\`Calculation error: \${error.message}\`);
  }
  
  return { result, expression, variables };
}
`;
  }

  private generateGenericTool(requirement: ToolRequirement): string {
    return `
async function execute(input) {
  // ${requirement.description}
  // Expected output: ${requirement.expectedOutput}
  
  // TODO: Implement tool logic
  console.log('Executing ${requirement.name} with input:', input);
  
  return {
    success: true,
    message: 'Tool executed successfully',
    input: input
  };
}
`;
  }
}

// ============================================================================
// Static Analyzer
// ============================================================================

class StaticAnalyzer {
  private dangerousPatterns = [
    /require\s*\(\s*['"]child_process['"]\s*\)/,
    /require\s*\(\s*['"]fs['"]\s*\)/,
    /require\s*\(\s*['"]path['"]\s*\)/,
    /process\.exit/,
    /eval\s*\(/,
    /Function\s*\(/,
    /while\s*\(\s*true\s*\)/,
    /for\s*\(\s*;\s*;\s*\)/,
  ];

  /**
   * 分析代码安全性
   */
  analyze(code: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 检查危险模式
    for (const pattern of this.dangerousPatterns) {
      if (pattern.test(code)) {
        errors.push(`Dangerous pattern detected: ${pattern}`);
      }
    }

    // 检查是否包含 execute 函数
    if (!code.includes('async function execute')) {
      errors.push('Code must export an async function named "execute"');
    }

    // 检查是否有 console.log（警告）
    if (code.includes('console.log')) {
      warnings.push('Code contains console.log, consider removing in production');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
}

// ============================================================================
// Sandbox Executor
// ============================================================================

class SandboxExecutor {
  private config: SandboxConfig;

  constructor(config?: Partial<SandboxConfig>) {
    this.config = {
      timeout: config?.timeout || 5000,
      maxMemory: config?.maxMemory || 128 * 1024 * 1024, // 128MB
      allowedAPIs: config?.allowedAPIs || ['fetch', 'console']
    };
  }

  /**
   * 在沙箱中执行代码
   */
  async execute(code: string, input: any): Promise<any> {
    // 创建沙箱上下文
    const sandbox: any = {
      input,
      result: null,
      error: null
    };

    // 添加允许的 API
    if (this.config.allowedAPIs.includes('fetch')) {
      sandbox.fetch = fetch;
    }
    if (this.config.allowedAPIs.includes('console')) {
      sandbox.console = {
        log: (...args: any[]) => console.log('[Sandbox]', ...args),
        error: (...args: any[]) => console.error('[Sandbox]', ...args)
      };
    }

    // 包装代码
    const wrappedCode = `
      (async () => {
        ${code}
        try {
          result = await execute(input);
        } catch (e) {
          error = e.message;
        }
      })();
    `;

    // 执行
    try {
      const script = new vm.Script(wrappedCode);
      const context = vm.createContext(sandbox);
      
      // 设置超时
      script.runInContext(context, {
        timeout: this.config.timeout
      });

      // 等待异步操作完成
      await new Promise(resolve => setTimeout(resolve, 100));

      if (sandbox.error) {
        throw new Error(sandbox.error);
      }

      return sandbox.result;
    } catch (error: any) {
      if (error.code === 'ERR_SCRIPT_EXECUTION_TIMEOUT') {
        throw new Error(`Execution timed out after ${this.config.timeout}ms`);
      }
      throw error;
    }
  }
}

// ============================================================================
// Tool Registry
// ============================================================================

class ToolRegistry {
  private tools: Map<string, Tool> = new Map();
  private storagePath: string;

  constructor(storagePath: string = './tools') {
    this.storagePath = storagePath;
    this.loadTools();
  }

  register(tool: Tool): void {
    this.tools.set(tool.name, tool);
    this.saveTools();
    console.log(`✅ Tool registered: ${tool.name}`);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  list(): Tool[] {
    return Array.from(this.tools.values());
  }

  private loadTools(): void {
    const toolPath = path.join(this.storagePath, 'registry.json');
    if (fs.existsSync(toolPath)) {
      const data = JSON.parse(fs.readFileSync(toolPath, 'utf-8'));
      data.forEach((t: any) => {
        this.tools.set(t.name, {
          ...t,
          createdAt: new Date(t.createdAt)
        });
      });
    }
  }

  private saveTools(): void {
    if (!fs.existsSync(this.storagePath)) {
      fs.mkdirSync(this.storagePath, { recursive: true });
    }
    const data = Array.from(this.tools.values());
    fs.writeFileSync(
      path.join(this.storagePath, 'registry.json'),
      JSON.stringify(data, null, 2)
    );
  }
}

// ============================================================================
// Tool Factory
// ============================================================================

class ToolFactory {
  private generator: ToolCodeGenerator;
  private analyzer: StaticAnalyzer;
  private sandbox: SandboxExecutor;
  private registry: ToolRegistry;

  constructor() {
    this.generator = new ToolCodeGenerator();
    this.analyzer = new StaticAnalyzer();
    this.sandbox = new SandboxExecutor();
    this.registry = new ToolRegistry();
  }

  /**
   * 合成新工具
   */
  async synthesize(requirement: ToolRequirement): Promise<Tool> {
    console.log(`🔨 Synthesizing tool: ${requirement.name}`);

    // 1. 生成代码
    const code = this.generator.generateCode(requirement);
    console.log('   - Code generated');

    // 2. 静态分析
    const validation = this.analyzer.analyze(code);
    if (!validation.valid) {
      throw new Error(`Code validation failed: ${validation.errors.join(', ')}`);
    }
    if (validation.warnings.length > 0) {
      console.log('   - Warnings:', validation.warnings);
    }

    // 3. 沙箱测试
    const testInput = this.generateTestInput(requirement.inputSchema);
    try {
      const result = await this.sandbox.execute(code, testInput);
      console.log('   - Sandbox test passed');
    } catch (error: any) {
      throw new Error(`Sandbox test failed: ${error.message}`);
    }

    // 4. 创建工具
    const tool: Tool = {
      name: requirement.name,
      description: requirement.description,
      execute: async (input: any) => {
        return this.sandbox.execute(code, input);
      },
      inputSchema: requirement.inputSchema,
      createdAt: new Date()
    };

    // 5. 注册
    this.registry.register(tool);

    return tool;
  }

  /**
   * 生成测试输入
   */
  private generateTestInput(schema: ToolRequirement['inputSchema']): any {
    const input: any = {};
    for (const [key, prop] of Object.entries(schema.properties)) {
      switch (prop.type) {
        case 'string':
          input[key] = 'test';
          break;
        case 'number':
          input[key] = 42;
          break;
        case 'boolean':
          input[key] = true;
          break;
        case 'object':
          input[key] = {};
          break;
        case 'array':
          input[key] = [];
          break;
        default:
          input[key] = null;
      }
    }
    return input;
  }

  /**
   * 获取工具
   */
  getTool(name: string): Tool | undefined {
    return this.registry.get(name);
  }

  /**
   * 列出所有工具
   */
  listTools(): Tool[] {
    return this.registry.list();
  }
}

// ============================================================================
// Demo
// ============================================================================

async function runDemo() {
  console.log('='.repeat(60));
  console.log('Tool Factory (Live-SWE-agent) - PoC Demo');
  console.log('='.repeat(60));
  console.log();

  const factory = new ToolFactory();

  // 1. 创建 Fetch 工具
  console.log('1. Creating a fetch tool...');
  console.log('-'.repeat(40));

  const fetchToolReq: ToolRequirement = {
    name: 'api_fetcher',
    description: 'Fetch data from a REST API endpoint',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'The URL to fetch' },
        options: { type: 'object', description: 'Fetch options' }
      },
      required: ['url']
    },
    expectedOutput: 'JSON response from the API'
  };

  try {
    const fetchTool = await factory.synthesize(fetchToolReq);
    console.log(`✅ Tool created: ${fetchTool.name}`);
    console.log(`   Description: ${fetchTool.description}`);
    console.log();
  } catch (error: any) {
    console.log(`❌ Failed: ${error.message}`);
    console.log();
  }

  // 2. 创建解析工具
  console.log('2. Creating a parser tool...');
  console.log('-'.repeat(40));

  const parseToolReq: ToolRequirement = {
    name: 'text_parser',
    description: 'Parse text data into structured format',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Text to parse' },
        format: { type: 'string', description: 'Format (json, csv)' }
      },
      required: ['text']
    },
    expectedOutput: 'Parsed data object'
  };

  try {
    const parseTool = await factory.synthesize(parseToolReq);
    console.log(`✅ Tool created: ${parseTool.name}`);
    console.log(`   Description: ${parseTool.description}`);
    console.log();
  } catch (error: any) {
    console.log(`❌ Failed: ${error.message}`);
    console.log();
  }

  // 3. 测试工具
  console.log('3. Testing the parser tool...');
  console.log('-'.repeat(40));

  const parser = factory.getTool('text_parser');
  if (parser) {
    try {
      const result = await parser.execute({
        text: '{"name": "test", "value": 123}',
        format: 'json'
      });
      console.log('Result:', result);
    } catch (error: any) {
      console.log('Error:', error.message);
    }
  }
  console.log();

  // 4. 列出所有工具
  console.log('4. All registered tools:');
  console.log('-'.repeat(40));
  const tools = factory.listTools();
  tools.forEach(t => {
    console.log(`   - ${t.name}: ${t.description}`);
  });
  console.log();

  // 5. 尝试创建危险工具（应该失败）
  console.log('5. Attempting to create a dangerous tool...');
  console.log('-'.repeat(40));

  const dangerousReq: ToolRequirement = {
    name: 'dangerous_tool',
    description: 'A tool that tries to access filesystem',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path' }
      }
    },
    expectedOutput: 'File contents'
  };

  // 手动注入危险代码（模拟攻击）
  const dangerousCode = `
    async function execute(input) {
      const fs = require('fs');
      return fs.readFileSync(input.path, 'utf-8');
    }
  `;

  const analyzer = new StaticAnalyzer();
  const validation = analyzer.analyze(dangerousCode);
  console.log('Validation result:', validation);

  console.log();
  console.log('='.repeat(60));
  console.log('Demo completed!');
  console.log('='.repeat(60));
}

// 运行 Demo
if (require.main === module) {
  runDemo().catch(console.error);
}

export {
  ToolFactory,
  ToolCodeGenerator,
  StaticAnalyzer,
  SandboxExecutor,
  ToolRegistry,
  Tool,
  ToolRequirement,
  ValidationResult
};
