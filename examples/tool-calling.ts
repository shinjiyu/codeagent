/**
 * SWE-Agent-Node Tool Calling 示例
 * 
 * 演示如何使用 LLMClient 的 Tool Calling 功能
 */

import { LLMClient, BUILTIN_TOOLS } from '../src';
import type { Tool } from '../src/types';

async function demonstrateToolCalling() {
  console.log('=== SWE-Agent-Node Tool Calling 示例 ===\n');

  // 1. 创建 LLM 客户端
  console.log('📦 步骤 1: 创建 LLM 客户端');
  const llm = new LLMClient({
    model: 'gpt-4',
    temperature: 0.7,
    maxTokens: 2000,
  });
  console.log('   客户端已创建\n');

  // 2. 注册内置工具
  console.log('🔧 步骤 2: 注册工具');
  llm.registerTools(BUILTIN_TOOLS);
  console.log(`   已注册 ${BUILTIN_TOOLS.length} 个内置工具:`);
  BUILTIN_TOOLS.forEach(tool => {
    console.log(`   - ${tool.name}: ${tool.description}`);
  });
  console.log();

  // 3. 注册自定义工具
  console.log('⚡ 步骤 3: 注册自定义工具');
  
  const customTools: Tool[] = [
    {
      name: 'get_package_info',
      description: '获取 package.json 的信息',
      parameters: [
        { 
          name: 'field', 
          type: 'string', 
          required: false, 
          description: '要获取的字段名 (如 name, version, dependencies)' 
        },
      ],
      execute: async (params: { field?: string }) => {
        const fs = await import('fs');
        const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf-8'));
        
        if (params.field) {
          return { value: packageJson[params.field] };
        }
        return packageJson;
      },
    },
    {
      name: 'list_files',
      description: '列出目录中的文件',
      parameters: [
        { name: 'dir', type: 'string', required: false, description: '目录路径 (默认为当前目录)' },
        { name: 'ext', type: 'string', required: false, description: '文件扩展名过滤' },
      ],
      execute: async (params: { dir?: string; ext?: string }) => {
        const fs = await import('fs');
        const dir = params.dir || '.';
        const files = fs.readdirSync(dir);
        
        if (params.ext) {
          return { 
            files: files.filter(f => f.endsWith(params.ext!)) 
          };
        }
        return { files };
      },
    },
  ];

  llm.registerTools(customTools);
  console.log('   已注册自定义工具:');
  customTools.forEach(tool => {
    console.log(`   - ${tool.name}: ${tool.description}`);
  });
  console.log();

  // 4. 查看工具定义
  console.log('📋 步骤 4: 查看工具定义');
  const definitions = llm.getToolDefinitions();
  console.log(`   总共 ${definitions.length} 个工具已就绪\n`);

  // 5. 模拟 Tool Calling 流程
  console.log('🔄 步骤 5: Tool Calling 流程说明');
  console.log(`
   当调用 llm.generate() 时:
   
   1. 发送用户消息 + 工具定义给 LLM
   2. LLM 决定是否需要调用工具
   3. 如果需要，返回 tool_calls
   4. 执行工具调用，获取结果
   5. 将结果发回 LLM
   6. LLM 生成最终响应
   7. 重复步骤 2-6 直到没有更多 tool calls
  `);

  // 6. 示例：直接执行工具调用
  console.log('⚡ 步骤 6: 直接执行工具调用');
  
  const toolCallResult = await llm.executeToolCall({
    id: 'call-demo',
    type: 'function',
    function: {
      name: 'get_package_info',
      arguments: '{"field": "name"}',
    },
  });
  
  console.log(`   工具调用结果: ${toolCallResult}\n`);

  // 7. 使用示例代码
  console.log('📝 完整使用示例:');
  console.log(`
  import { LLMClient, BUILTIN_TOOLS } from 'swe-agent-node';

  const llm = new LLMClient({ model: 'gpt-4' });
  
  // 注册工具
  llm.registerTools(BUILTIN_TOOLS);
  
  // 自定义工具
  llm.registerTool({
    name: 'my_tool',
    description: '我的自定义工具',
    parameters: [
      { name: 'input', type: 'string', required: true, description: '输入' }
    ],
    execute: async (params) => {
      // 工具实现
      return { result: 'processed: ' + params.input };
    }
  });
  
  // 生成响应（自动处理 Tool Calling）
  const response = await llm.generate(\`
    请分析当前项目的 package.json 文件，
    列出所有依赖项，并告诉我项目的名称和版本。
  \`);
  
  console.log(response);
  `);

  console.log('\n✅ 示例完成!');
  
  console.log('\n💡 提示:');
  console.log('   - Tool Calling 需要 LLM API 支持该功能');
  console.log('   - 当前实现返回模拟响应，需要对接真实 API');
  console.log('   - 参考 src/llm-client.ts 底部的 OpenClaw 集成示例');
}

// 运行示例
demonstrateToolCalling().catch(console.error);
