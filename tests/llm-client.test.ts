/**
 * LLMClient Tool Calling 测试
 */

import { LLMClient, BUILTIN_TOOLS } from '../src/llm-client';
import type { Tool, ToolCall } from '../src/types';

describe('LLMClient Tool Calling', () => {
  let client: LLMClient;

  beforeEach(() => {
    client = new LLMClient({
      model: 'test-model',
      temperature: 0.7,
    });
  });

  describe('registerTool', () => {
    it('应该注册单个工具', () => {
      const tool: Tool = {
        name: 'test_tool',
        description: '测试工具',
        execute: async () => ({ result: 'ok' }),
      };

      client.registerTool(tool);

      const definitions = client.getToolDefinitions();
      expect(definitions).toHaveLength(1);
      expect(definitions[0].function.name).toBe('test_tool');
    });

    it('应该正确构建工具参数定义', () => {
      const tool: Tool = {
        name: 'read_file',
        description: '读取文件',
        parameters: [
          { name: 'path', type: 'string', required: true, description: '文件路径' },
          { name: 'encoding', type: 'string', required: false, description: '编码' },
        ],
        execute: async () => ({}),
      };

      client.registerTool(tool);

      const definitions = client.getToolDefinitions();
      expect(definitions[0].function.parameters.properties.path).toBeDefined();
      expect(definitions[0].function.parameters.required).toContain('path');
    });
  });

  describe('registerTools', () => {
    it('应该注册多个工具', () => {
      const tools: Tool[] = [
        { name: 'tool1', description: '工具1', execute: async () => ({}) },
        { name: 'tool2', description: '工具2', execute: async () => ({}) },
      ];

      client.registerTools(tools);

      const definitions = client.getToolDefinitions();
      expect(definitions).toHaveLength(2);
    });

    it('应该注册内置工具', () => {
      client.registerTools(BUILTIN_TOOLS);

      const definitions = client.getToolDefinitions();
      expect(definitions.length).toBeGreaterThan(0);
      expect(definitions.find(d => d.function.name === 'read_file')).toBeDefined();
    });
  });

  describe('executeToolCall', () => {
    it('应该执行工具并返回结果', async () => {
      const tool: Tool = {
        name: 'echo',
        description: '回显输入',
        parameters: [
          { name: 'message', type: 'string', required: true, description: '消息' },
        ],
        execute: async (params) => ({ echoed: params.message }),
      };

      client.registerTool(tool);

      const toolCall: ToolCall = {
        id: 'call-1',
        type: 'function',
        function: {
          name: 'echo',
          arguments: '{"message":"hello"}',
        },
      };

      const result = await client.executeToolCall(toolCall);
      expect(result).toBe('{"echoed":"hello"}');
    });

    it('应该处理未知工具', async () => {
      const toolCall: ToolCall = {
        id: 'call-1',
        type: 'function',
        function: {
          name: 'unknown_tool',
          arguments: '{}',
        },
      };

      const result = await client.executeToolCall(toolCall);
      expect(result).toContain('Unknown tool');
    });

    it('应该处理无效的 JSON 参数', async () => {
      const tool: Tool = {
        name: 'test',
        description: '测试',
        execute: async () => ({}),
      };

      client.registerTool(tool);

      const toolCall: ToolCall = {
        id: 'call-1',
        type: 'function',
        function: {
          name: 'test',
          arguments: 'not valid json',
        },
      };

      const result = await client.executeToolCall(toolCall);
      expect(result).toContain('error');
    });
  });

  describe('clearHistory', () => {
    it('应该清空消息历史', async () => {
      await client.generateSimple('test prompt');
      client.clearHistory();
      
      // 历史已清空，再次调用不会有之前的上下文
      // 这里只是验证方法不会报错
      expect(() => client.clearHistory()).not.toThrow();
    });
  });

  describe('generateSimple', () => {
    it('应该生成响应', async () => {
      const response = await client.generateSimple('Hello');
      
      expect(response).toBeDefined();
      expect(typeof response).toBe('string');
    });
  });
});

describe('BUILTIN_TOOLS', () => {
  it('应该包含 read_file 工具', () => {
    const tool = BUILTIN_TOOLS.find(t => t.name === 'read_file');
    expect(tool).toBeDefined();
    expect(tool?.parameters).toHaveLength(1);
  });

  it('应该包含 write_file 工具', () => {
    const tool = BUILTIN_TOOLS.find(t => t.name === 'write_file');
    expect(tool).toBeDefined();
    expect(tool?.parameters).toHaveLength(2);
  });

  it('应该包含 run_command 工具', () => {
    const tool = BUILTIN_TOOLS.find(t => t.name === 'run_command');
    expect(tool).toBeDefined();
  });

  it('应该包含 search_code 工具', () => {
    const tool = BUILTIN_TOOLS.find(t => t.name === 'search_code');
    expect(tool).toBeDefined();
  });
});
