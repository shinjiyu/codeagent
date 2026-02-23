# 竞品研究报告

**研究日期**: 2026-02-23  
**迭代编号**: #5

---

## 主要竞品

### 1. SWE-agent (Princeton/Stanford)

**GitHub**: https://github.com/SWE-agent/SWE-agent  
**最新版本**: v1.1.0 (2026-05-22)

#### 核心特性
- 🏆 **SOTA 性能**: SWE-bench full/lite/verified 排行榜第一
- 📦 **YAML 配置驱动**: 单一 YAML 文件管理所有工具和行为
- 🔧 **可扩展工具系统**: 支持自定义工具包
- 🌐 **多模型支持**: GPT-4o, Claude 3.7, Gemini 等

#### 最新进展 (v1.1.0)
- **SWE-smith 集成**: 生成数万条训练轨迹
- **SWE-agent-LM-32b**: 开源权重 SOTA 模型
- **多语言/多模态支持**: 扩展到更多编程语言
- **Claude 3.7 优化**: 针对新模型的 token 限制调整

#### 关键设计
- HistoryProcessor: 处理对话历史
- 状态ful Shell: 保持终端会话
- 复杂工具接口: 需要特定的工具调用格式

---

### 2. mini-SWE-agent

**GitHub**: https://github.com/SWE-agent/mini-swe-agent  
**定位**: SWE-agent 的极简版本

#### 核心理念
> *"What if our agent was 100x simpler, and still worked nearly as well?"*

#### 关键特性
- 🎯 **极致简洁**: Agent 核心仅 ~100 行 Python
- 🔨 **Bash 优先**: 唯一工具是 Bash，无需 tool-calling
- 📊 **高性能**: SWE-bench verified >74% (Gemini 3 Pro)
- 🚀 **快速启动**: 比 Claude Code 更快

#### 设计哲学
1. **无需工具调用接口** - LM 直接使用 shell
2. **独立进程执行** - 每个动作独立 (subprocess.run)
3. **线性历史** - 轨迹即消息，易于调试和 fine-tuning
4. **易于沙箱化** - 切换 subprocess.run 到 docker exec 即可

#### 用户群体
Meta, NVIDIA, IBM, Essential AI, Princeton, Stanford 等广泛采用

---

### 3. SWE-ReX

**GitHub**: https://github.com/SWE-agent/SWE-ReX  
**定位**: 沙箱执行框架

#### 核心能力
- 🐚 **Shell 会话管理**: 支持交互式命令 (ipython, gdb)
- ⚡ **大规模并行**: 支持 100+ 并发 agent 运行
- 🔒 **多平台沙箱**: Docker, AWS, Modal, Fargate
- 🔌 **统一接口**: 本地和远程代码一致

#### 架构优势
- 解耦 agent 逻辑和基础设施
- 支持非 Linux 机器
- 简化大规模评估

---

### 4. SWE-smith

**GitHub**: https://github.com/SWE-bench/SWE-smith  
**定位**: 训练数据生成

#### 核心价值
- 📈 **大规模训练数据**: 数万条轨迹
- 🤖 **SWE-agent-LM-32b**: 开源 SOTA 模型
- 🔄 **自动化生成**: 从 GitHub issue 自动生成训练样本

---

## 竞品对比矩阵

| 特性 | SWE-agent | mini-SWE-agent | SWE-agent-node |
|------|-----------|----------------|----------------|
| **语言** | Python | Python | TypeScript |
| **核心代码** | ~5000 行 | ~100 行 | ~500 行 |
| **工具系统** | 复杂 YAML | 仅 Bash | Bash 为主 |
| **历史处理** | HistoryProcessor | 线性 | 线性 |
| **执行方式** | 状态ful Shell | 独立进程 | 独立进程 |
| **自进化** | ❌ | ❌ | ✅ 核心特性 |
| **沙箱支持** | SWE-ReX | 多种 | Docker |
| **SWE-bench** | SOTA | 74%+ | 待测试 |

---

## 关键学习

### 1. 简洁设计的重要性
mini-SWE-agent 的成功证明：**100 行代码 + 强 LM > 复杂工具系统**

> *"Make the agent so simple that the LM shines"*

**应用到 SWE-agent-node**:
- 保持 Bash 为主的设计
- 最小化自定义工具
- 依赖 LM 能力而非工具复杂性

### 2. 独立进程执行的优势
相比状态ful Shell，独立进程：
- 更稳定（无会话状态问题）
- 易于沙箱化
- 支持大规模并行

**已应用到 SWE-agent-node**: ✅ ShellEnv 使用独立进程

### 3. 线性历史的价值
- 轨迹即训练数据
- 易于调试和分析
- 便于 fine-tuning

**已应用到 SWE-agent-node**: ✅ 线性 Step 记录

### 4. 训练数据的重要性
SWE-smith 表明：**高质量训练轨迹是关键**

**应用到 SWE-agent-node**:
- EvolutionStore 记录完整轨迹
- 支持未来 fine-tuning

---

## SWE-agent-node 的差异化

### 核心优势

1. **自进化能力** (独特)
   - 从成功/失败中学习
   - 模式挖掘和知识积累
   - 策略自动优化

2. **TypeScript/Node.js 生态**
   - 与前端/全栈项目无缝集成
   - npm 生态优势
   - 更好的异步处理

3. **OpenClaw 深度集成**
   - 统一的 LLM 接口
   - Skill 系统支持
   - 沙箱环境

### 待改进

1. **性能基准**: 需要在 SWE-bench 上测试
2. **多语言支持**: 目前主要是 JS/TS
3. **并行执行**: 需要类似 SWE-ReX 的能力

---

## 行动建议

### 短期 (v0.2)
- [ ] 在 SWE-bench lite 上评估性能
- [ ] 参考 mini-SWE-agent 简化工具系统
- [ ] 添加更多模型支持

### 中期 (v0.3)
- [ ] 实现类似 SWE-ReX 的并行执行
- [ ] 构建训练数据生成能力
- [ ] 优化自进化算法

### 长期 (v1.0)
- [ ] 多语言支持
- [ ] 开源模型 fine-tuning
- [ ] 社区贡献生态

---

## 参考链接

- [SWE-agent 文档](https://swe-agent.com)
- [mini-SWE-agent 文档](https://mini-swe-agent.com)
- [SWE-ReX 文档](https://swe-rex.com)
- [SWE-smith](https://swesmith.com)
- [SWE-bench 排行榜](https://www.swebench.com)
