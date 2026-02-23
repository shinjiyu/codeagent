# SWE-Agent-Node 项目目标

## 仓库信息
- **GitHub**: https://github.com/shinjiyu/codeagent
- **Owner**: shinjiyu

## 愿景

创建一个 **自进化的 Node.js 软件开发 AI Agent**，能够：
- 自主修复 GitHub Issues
- 理解和修改代码库
- 从经验中学习和改进
- 与 OpenClaw 生态系统深度集成

## 核心设计原则

### 1. 简洁优先 (Simplicity First)
借鉴 mini-SWE-agent 的哲学：**100 行核心代码胜过 10000 行复杂系统**
- 最小化工具集，最大化 LM 能力
- 线性历史，易于调试和 fine-tuning
- 独立执行，易于沙箱化和扩展

### 2. 自进化能力 (Self-Evolution)
这是与原版 SWE-agent 的核心差异：
- **经验记忆**: 记录每次执行的成功/失败模式
- **模式学习**: 从错误中提炼可复用策略
- **知识积累**: 构建解决方案知识库
- **策略优化**: 动态调整代码修改策略

### 3. OpenClaw 原生集成
- 使用 OpenClaw 的 LLM 接口
- 集成到 OpenClaw Skill 系统
- 支持 OpenClaw 的沙箱环境
- 与 Evolution Store 联动

## 关键特性

### 第一阶段：基础能力 (v0.1)
- ✅ Git 仓库克隆和基本操作
- ✅ Issue/问题描述解析
- ✅ 代码搜索和定位
- ✅ AI 驱动的代码修改
- ✅ 自动测试验证
- ⏳ PR/Commit 自动生成

### 第二阶段：智能增强 (v0.2)
- ⏳ 多步骤推理链
- ⏳ 上下文窗口优化
- ⏳ 错误恢复机制
- ⏳ 部分成功处理

### 第三阶段：自进化 (v0.3)
- ⏳ 执行历史分析
- ⏳ 模式挖掘和学习
- ⏳ 策略自动优化
- ⏳ 知识库自动构建

### 第四阶段：生态集成 (v1.0)
- ⏳ OpenClaw Skill 发布
- ⏳ 多语言支持
- ⏳ 团队协作模式
- ⏳ 可视化界面

## 与原版 SWE-agent 的对比

> 📋 **详细竞品分析**: 参见 [竞品研究报告](./docs/COMPETITOR_RESEARCH.md)

| 特性 | SWE-agent (Python) | mini-SWE-agent | SWE-agent-node |
|------|-------------------|----------------|----------------|
| 核心代码量 | ~5000 行 | ~100 行 | ~500 行 (目标) |
| 工具系统 | 复杂 YAML 配置 | 仅 Bash | 简单 Bash 为主 |
| 历史处理 | HistoryProcessor | 线性历史 | 线性历史 |
| 执行方式 | 状态ful Shell | 独立进程 | 独立进程 |
| SWE-bench | SOTA | 74%+ | 待测试 |
| 自进化 | ❌ | ❌ | ✅ 核心特性 |
| OpenClaw 集成 | ❌ | ❌ | ✅ 深度集成 |

### 竞品最新动态 (2026-02)

- **SWE-agent v1.1.0**: 集成 SWE-smith 训练数据生成，发布 SWE-agent-LM-32b 开源模型
- **mini-SWE-agent**: 100 行代码实现 74%+ SWE-bench verified，被 Meta/NVIDIA/IBM 等采用
- **SWE-ReX**: 大规模并行沙箱执行框架，支持 100+ 并发 agent
- **关键趋势**: 简洁设计 + 强 LM > 复杂工具系统

## 成功指标

- **可用性**: 能独立解决真实 GitHub Issue
- **效率**: 30 分钟内完成简单修复
- **质量**: 生成的代码通过测试
- **学习**: 每次执行后知识库增长
- **复用**: 重复问题的解决速度提升

## 技术栈

- **运行时**: Node.js 18+
- **语言**: TypeScript
- **Git 操作**: simple-git
- **LLM**: OpenClaw 接口 (支持多模型)
- **测试**: Jest
- **沙箱**: Docker (可选)

## 路线图

```
2026-02 (MVP):
├─ 基础框架
├─ Git 集成
├─ 代码搜索
└─ 简单修改

2026-03 (智能增强):
├─ 多步骤推理
├─ 错误恢复
├─ 上下文优化
└─ 测试集成

2026-04 (自进化):
├─ 经验记忆系统
├─ 模式挖掘引擎
├─ 策略优化器
└─ 知识库构建

2026-05+ (生态):
├─ Skill 发布
├─ 多语言支持
├─ 可视化
└─ 团队功能
```

## 贡献

欢迎通过以下方式贡献：
- 提交 Issue 报告 bug
- 分享成功的修复案例
- 贡献新的工具函数
- 改进文档和示例

---

*"Make the agent so simple that the LM shines"*
