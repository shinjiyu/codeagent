# Tool Factory 设计文档

## 概述

Tool Factory 实现运行时工具合成能力，让 Agent 能够动态创建新工具。

## 架构

```
┌─────────────────────────────────────────────────────────────┐
│                      Tool Factory                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │  Requirement │───▶│    Code      │───▶│   Static     │  │
│  │   Analyzer   │    │  Generator   │    │   Analyzer   │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│                                                   │          │
│                                                   ▼          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   Registry   │◀───│   Sandbox    │◀───│  Validator   │  │
│  │              │    │   Executor   │    │              │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## 核心组件

### 1. Requirement Analyzer

分析工具需求，转换为可执行的规格。

```typescript
interface ToolRequirement {
  name: string;
  description: string;
  inputSchema: JSONSchema;
  expectedOutput: string;
  constraints?: {
    timeout?: number;
    memory?: number;
    allowedAPIs?: string[];
  };
}
```

### 2. Code Generator

生成工具代码。

**策略**:
1. 模板匹配：根据需求类型选择模板
2. LLM 生成：使用 LLM 生成自定义代码
3. 混合模式：模板 + LLM 增强组合

### 3. Static Analyzer

静态分析代码安全性。

**检查项**:
- 危险 API 调用（fs, child_process, process）
- 无限循环
- eval/Function 构造
- 内存泄漏风险

### 4. Sandbox Executor

沙箱执行环境。

**安全措施**:
- vm2 / isolated-vm 隔离
- 超时限制
- 内存限制
- API 白名单

### 5. Validator

验证工具功能。

**验证流程**:
1. 类型检查
2. 功能测试
3. 边界测试
4. 性能测试

### 6. Registry

工具注册中心。

**功能**:
- 工具注册/注销
- 版本管理
- 工具查找
- 工具调用

## 安全模型

### 多层防护

```
┌─────────────────────────────────────────┐
│         Layer 1: Static Analysis        │
│   • 检查危险模式                         │
│   • AST 分析                             │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│         Layer 2: Sandbox Isolation       │
│   • vm2 / isolated-vm                    │
│   • 资源限制                              │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│         Layer 3: Runtime Monitoring      │
│   • 执行超时                              │
│   • 内存监控                              │
│   • 异常捕获                              │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│         Layer 4: API Whitelist           │
│   • 只允许特定 API                        │
│   • 网络、文件系统隔离                    │
└─────────────────────────────────────────┘
```

## 使用示例

```typescript
const factory = new ToolFactory();

// 创建工具
const tool = await factory.synthesize({
  name: 'json_validator',
  description: 'Validate JSON structure against a schema',
  inputSchema: {
    type: 'object',
    properties: {
      json: { type: 'string', description: 'JSON string to validate' },
      schema: { type: 'object', description: 'JSON Schema' }
    },
    required: ['json', 'schema']
  },
  expectedOutput: '{ valid: boolean, errors?: string[] }'
});

// 使用工具
const result = await tool.execute({
  json: '{"name": "test"}',
  schema: { type: 'object', properties: { name: { type: 'string' } } }
});

console.log(result); // { valid: true }
```

## 配置

```yaml
tool_factory:
  enabled: true
  
  sandbox:
    timeout: 5000          # 5 秒超时
    max_memory: 128MB      # 最大内存
    allowed_apis:
      - fetch
      - console
      - JSON
      - Math
      - Date
  
  code_generator:
    strategy: hybrid       # template | llm | hybrid
    max_code_length: 5000  # 最大代码长度
  
  validation:
    run_tests: true
    test_cases: 3          # 自动生成测试用例数
```

## 性能优化

### 工具缓存

```typescript
interface ToolCache {
  get(requirement: ToolRequirement): Tool | null;
  set(requirement: ToolRequirement, tool: Tool): void;
  invalidate(name: string): void;
}
```

### 懒加载

工具在首次使用时才加载到内存。

### 预编译

常用工具模板预编译为字节码。

## 监控

### 指标

| 指标 | 描述 | 目标 |
|------|------|------|
| `tool_creation_success_rate` | 工具创建成功率 | > 90% |
| `tool_execution_latency` | 工具执行延迟 | < 100ms |
| `sandbox_timeout_rate` | 沙箱超时率 | < 1% |
| `cache_hit_rate` | 缓存命中率 | > 50% |

## 限制

1. **不能创建**:
   - 文件系统操作工具
   - 网络监听工具
   - 子进程创建工具

2. **资源限制**:
   - 最大代码长度: 5KB
   - 执行超时: 5 秒
   - 内存限制: 128MB

## 未来扩展

1. **工具组合**: 允许工具之间组合调用
2. **工具市场**: 共享和发现工具
3. **工具优化**: 自动优化工具性能
4. **工具测试**: 自动生成测试套件

---

*版本: 1.0.0*
*创建日期: 2026-02-24*
