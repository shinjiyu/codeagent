# 竞品研究报告

**研究日期**: 2026-02-23  
**最后更新**: 2026-02-23 (迭代 #9)

---

## 🔥 最新动态 (2026-02)

### mini-SWE-agent v2.0 发布
**发布日期**: 2026-02-11  
**这是自项目发布以来最大的更新！**

#### 核心变更
- **Tool Calls**: 原生支持 tool calling API（但仍保留文本解析）
- **Multimodal Input**: 支持图片和其他内容类型
- **更灵活的模型支持**: 改进的模型配置系统

#### 最新版本 (v2.2.x)
- v2.2.3 (2026-02-20): 最新修复
- v2.2.0 (2026-02-18): 新增 ContreeEnvironment (Nebius 开发)
- v2.1.0 (2026-02-12): 改进交互式 agent UX

#### 迁移指南
- v2 包含 breaking changes
- 详见官方 [v2 迁移指南](https://mini-swe-agent.com/latest/advanced/v2_migration/)

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

---

### 2. mini-SWE-agent v2

**GitHub**: https://github.com/SWE-agent/mini-swe-agent  
**最新版本**: v2.2.3 (2026-02-20)

#### v2 核心理念
> *"极简设计 + 原生 Tool Calling + 多模态支持"*

#### v2 新特性
| 特性 | v1 | v2 |
|------|----|----|
| Action 解析 | 纯文本 | Tool Calling + 文本 |
| 多模态 | ❌ | ✅ 图片等 |
| 模型支持 | 有限 | 灵活配置 |

#### 保留的设计
- ✅ 线性历史（便于调试和 fine-tuning）
- ✅ 独立进程执行
- ✅ 易于沙箱化

#### 新增环境
- **ContreeEnvironment**: Nebius 开发的容器环境
- **SwerexModalEnvironment**: Modal 云执行支持

#### 用户群体
Meta, NVIDIA, IBM, Essential AI, Princeton, Stanford, Nebius 等

---

### 3. SWE-ReX

**GitHub**: https://github.com/SWE-agent/SWE-ReX  
**定位**: 沙箱执行框架

#### 核心能力
- 🐚 **Shell 会话管理**: 支持交互式命令 (ipython, gdb)
- ⚡ **大规模并行**: 支持 100+ 并发 agent 运行
- 🔒 **多平台沙箱**: Docker, AWS, Modal, Fargate, Contree
- 🔌 **统一接口**: 本地和远程代码一致

---

### 4. SWE-smith

**GitHub**: https://github.com/SWE-bench/SWE-smith  
**定位**: 训练数据生成

#### 核心价值
- 📈 **大规模训练数据**: 数万条轨迹
- 🤖 **SWE-agent-LM-32b**: 开源 SOTA 模型
- 🔄 **自动化生成**: 从 GitHub issue 自动生成训练样本

---

## 竞品对比矩阵 (更新版)

| 特性 | SWE-agent | mini v2 | SWE-agent-node |
|------|-----------|---------|----------------|
| **语言** | Python | Python | TypeScript |
| **核心代码** | ~5000 行 | ~200 行 | ~500 行 |
| **Tool Calling** | ✅ YAML | ✅ 原生 | ⏳ 待实现 |
| **多模态** | ✅ | ✅ | ❌ |
| **工具系统** | 复杂 YAML | 灵活 | Bash 为主 |
| **历史处理** | HistoryProcessor | 线性 | 线性 |
| **执行方式** | 状态ful Shell | 独立进程 | 独立进程 |
| **自进化** | ❌ | ❌ | ✅ 核心特性 |
| **沙箱支持** | SWE-ReX | 多种 | Docker |
| **SWE-bench** | SOTA | 74%+ | 待测试 |

---

## 关键学习

### 1. Tool Calling 的重要性
mini-SWE-agent v2 增加原生 tool calling 支持，说明：
- 兼容更多模型的原生能力
- 但仍保留文本解析作为备选

**应用到 SWE-agent-node**:
- [ ] 实现原生 tool calling 接口
- [ ] 保持 Bash 作为备选方案

### 2. 多模态是趋势
支持图片输入已成为标配。

**应用到 SWE-agent-node**:
- [ ] 支持截图分析
- [ ] 支持 UI 错误图片

### 3. 沙箱环境多样化
ContreeEnvironment、Modal 等新选项。

**应用到 SWE-agent-node**:
- [ ] 调研 ContreeEnvironment
- [ ] 支持 Modal 云执行

### 4. 简洁设计仍然是核心
即使添加了 tool calling，mini 仍保持简洁。

---

## SWE-agent-node 的差异化 (更新)

### 核心优势

1. **自进化能力** (独特 ✨)
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

### 待实现 (基于竞品分析)

| 优先级 | 功能 | 参考 |
|--------|------|------|
| P0 | 原生 Tool Calling | mini v2 |
| P1 | 多模态支持 | mini v2 |
| P1 | 更多沙箱选项 | SWE-ReX |
| P2 | SWE-bench 评估 | 所有竞品 |

---

## 行动建议 (更新)

### 短期 (v0.2)
- [ ] 实现原生 tool calling 接口
- [ ] 在 SWE-bench lite 上评估性能
- [ ] 添加多模态输入支持

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
- [mini-SWE-agent v2 迁移指南](https://mini-swe-agent.com/latest/advanced/v2_migration/)
- [SWE-ReX 文档](https://swe-rex.com)
- [SWE-smith](https://swesmith.com)
- [SWE-bench 排行榜](https://www.swebench.com)
