# Neonity Agent - 阶段构建计划

> 品牌重命名自 `pi-agent-clone`，基于 Hermes Agent Self-Evolution 的自进化理念，
> 结合 Neonity 独特的 Soul/Memory 系统，构建具有自我进化能力的 AI Agent 框架。

---

## 阶段划分

| 阶段 | 名称 | 核心目标 | 优先级 |
|------|------|---------|--------|
| **0** | Foundation | 现有代码重构、品牌统一、文档完善 | 🔴 立即 |
| **1** | Trajectory Collector | 执行轨迹自动收集、存储结构化 | 🟡 高 |
| **2** | Self-Reflection | 基于轨迹的自我分析与评估 | 🟡 高 |
| **3** | Evolution Engine | GEPA 驱动的 Prompt/Skill 进化 | 🟢 中 |
| **4** | Continuous Loop | 自动化持续改进管道 | 🟢 中 |

---

## 阶段 0：Foundation

### 目标
品牌从 pi-agent-clone 正式过渡到 **Neonity**，清理代码库，建立基础文档。

### 时间预估
1-2 周

### 任务清单

- [ ] **重命名仓库**：`pi-agent-clone` → `neonity`
- [ ] **清理旧代码**：删除未使用的示例项目子目录
- [ ] **统一包名**：`package.json` 中的 name 改为 `@neonity/agent`
- [ ] **更新 imports**：所有内部 import 路径更新
- [ ] **CLAUDE.md 更新**：反映新项目名和架构
- [ ] **基础 README 重写**：品牌故事、特性、技术栈
- [ ] **LICENSE 文件**：添加 MIT License
- [ ] **GitHub repo 初始化**：Topics、Description、Website

### 检查标准

- `npm run build` 无错误
- `npm run typecheck` 无错误
- README 准确描述 Neonity 而非 pi-agent-clone

---

## 阶段 1：Trajectory Collector

### 目标
自动收集每一次 Agent 执行的完整轨迹，为自我进化提供数据基础。

### 背景
Hermes Agent Self-Evolution 的核心是"读取执行轨迹，理解为什么失败"。Neonity 需要先把轨迹收集起来。

### 设计思路

```
执行轨迹结构：
{
  sessionId: "uuid",
  timestamp: "ISO8601",
  model: "glm-5.1",
  provider: "glm",
  query: "用户原始输入",
  systemPrompt: "完整的 system prompt（含 SOUL/MEMORY）",
  messages: [
    { role: "user", content: "..." },
    { role: "assistant", content: "...", toolCalls: [...] },
    { role: "tool_result", content: "...", toolCallId: "..." }
  ],
  toolCalls: [
    { id, name, arguments, result, duration, isError }
  ],
  finalResponse: "最终回复",
  usage: { inputTokens, outputTokens },
  success: boolean,
  failureReason?: "timeout" | "error" | "max_iterations" | null
}
```

### 时间预估
2-3 周

### 任务清单

- [ ] **TrajectoryStorage 类**：将轨迹持久化到 `~/.neonity/trajectories/`
- [ ] **trajectory-id 生成**：每次 run 生成唯一 ID
- [ ] **轨迹采样策略**：全量 / 采样率 / 错误优先
- [ ] **轨迹压缩**：历史轨迹 gzip 压缩存储
- [ ] **session 管理**：session 归档与检索
- [ ] **Query complexity tag**：每次执行打上复杂度标签（简单/中等/复杂）

### API 设计

```typescript
interface TrajectoryStore {
  save(trajectory: Trajectory): Promise<string>;  // returns trajectoryId
  load(trajectoryId: string): Promise<Trajectory>;
  query(filter: TrajectoryFilter): Promise<Trajectory[]>;
  archive(oldSessions: Date): Promise<void>;
}
```

### 检查标准

- Agent 运行后轨迹自动保存到本地
- 可通过 CLI 查询历史轨迹

---

## 阶段 2：Self-Reflection Engine

### 目标
基于收集的轨迹，让 Agent 能够**分析自己的失败**，提出改进建议。

### 设计思路

不使用外部 LLM 评分，而是让 Neonity **自己反思**：

```
反思 Loop：
1. 加载失败轨迹
2. 让 Agent 分析："这次失败的原因是什么？"
3. Agent 提出改进建议："修改 SOUL.md / 调整工具描述 / 改进 system prompt"
4. Agent 执行修改
5. 记录反思结果到 trajectory.metadata
```

### 时间预估
3-4 周

### 任务清单

- [ ] **Reflection Tool**：让 Agent 调用 `neonity_reflect` 分析轨迹
- [ ] **反思 Prompt 模板**：设计引导 Agent 进行有效反思的 prompt
- [ ] **改进提案结构**：标准化的改进提案格式（提案类型、理由、预期效果）
- [ ] **自动 vs 手动触发**：可以配置是否自动触发反思
- [ ] **反思结果存储**：`trajectory.metadata.reflection = { analysis, proposals, changes }`
- [ ] **历史对比**：对比改进前后的执行效果

### API 设计

```typescript
interface Reflection {
  trajectoryId: string;
  analysis: string;           // 失败原因分析
  proposals: Proposal[];      // 改进建议列表
  applied: AppliedChange[];   // 已执行的修改
  timestamp: string;
}

interface Proposal {
  type: "soul" | "memory" | "tool_description" | "system_prompt" | "skill";
  target: string;             // 修改目标（如 soul_write 的 content）
  reason: string;            // 为什么这样改
  expectedEffect: string;    // 预期效果
}
```

### 检查标准

- Agent 能够分析自己过去的失败
- 反思结果可查询、可追溯

---

## 阶段 3：Evolution Engine

### 目标
实现 Hermes 式的 GEPA (Genetic-Pareto Prompt Evolution) 驱动进化。

### 设计思路

参考 Hermes Agent Self-Evolution 的架构，但适配 Neonity 的 Soul/Memory 系统：

```
Evolution Pipeline：
1. Select target — 选择要进化的对象（SOUL.md 条目 / 工具描述 / Skill）
2. Generate variants — 使用 LLM 生成多个变体
3. Evaluate — 在历史轨迹上测试变体效果
4. Select — 保留最优变体
5. Apply — 执行修改（如 soul_write）
6. Verify — Guardrails 检查
```

### 时间预估
4-6 周

### 任务清单

- [ ] **Variant Generator**：生成多个候选变体
- [ ] **Evaluation Framework**：定义评估指标（成功率、效率、用户满意度）
- [ ] **Pareto Optimization**：多目标优化（效果 vs 复杂度）
- [ ] **Change Applicator**：将选中的变体应用到对应文件
- [ ] **Guardrails Validator**：
  - [ ] 修改后测试必须通过
  - [ ] SOUL.md 条目大小限制（≤15KB）
  - [ ] 语义一致性检查（不能偏离原意）
- [ ] **Evolution Log**：记录每次进化的历史

### 约束条件

- 所有修改通过 PR review，不直接 commit
- 任何人可审核，Owner 最终合并

### 检查标准

- 可对 SOUL.md 进行进化测试
- 进化结果可回滚

---

## 阶段 4：Continuous Improvement Loop

### 目标
实现完全自动化的持续改进管道。

### 设计思路

```
Continuous Loop：
┌─────────────────────────────────────────────────────┐
│  Monitor Trajectories                               │
│       ↓                                             │
│  Detect Patterns (repeated failures)                │
│       ↓                                             │
│  Trigger Evolution when threshold met               │
│       ↓                                             │
│  Generate + Evaluate + Select variants              │
│       ↓                                             │
│  Create PR with proposed changes                     │
│       ↓                                             │
│  Human Review (guardrails pass → merge)             │
│       ↓                                             │
│  Deploy improved agent                              │
│       ↓                                             │
│  Monitor new performance ←──────────────────────────┘
```

### 时间预估
4-8 周

### 任务清单

- [ ] **Pattern Detector**：识别重复失败的模式
- [ ] **Threshold Config**：配置触发进化的条件（失败次数、错误类型）
- [ ] **Auto Evolution Runner**：自动执行完整进化流程
- [ ] **PR Automation**：自动创建 GitHub PR
- [ ] **Deploy Hook**：PR 合并后自动部署新版本
- [ ] **Dashboard**：Web UI 显示进化状态、历史、性能趋势
- [ ] **Notification**：进化完成/需要 review 时通知

### 监控指标

| 指标 | 描述 |
|------|------|
| success_rate | 执行成功率 |
| avg_iterations | 平均迭代次数 |
| avg_duration | 平均执行时长 |
| tool_error_rate | 工具错误率 |
| soul_evolution_count | SOUL.md 进化次数 |

### 检查标准

- 自动化管道可完整运行
- 有人工 review 机制保证质量

---

## 技术债务与注意事项

1. **暂不使用 GPU training**：全部 API 调用，参考 Hermes 的 $2-10/次成本
2. **保持简单**：先跑通，再优化
3. **可回滚**：每次进化结果可回退
4. **测试覆盖**：关键路径必须有测试

---

## 里程碑

| 里程碑 | 验收条件 |
|--------|---------|
| M0 | 仓库重命名完成，CI 绿灯 |
| M1 | 轨迹收集运行一周，数据完整 |
| M2 | Agent 能自主分析失败并提出改进 |
| M3 | 至少完成一次完整的 SOUL.md 进化循环 |
| M4 | 连续运行 30 天无人工干预的自动化改进 |

---

## 参考资料

- [Hermes Agent Self-Evolution](https://github.com/NousResearch/hermes-agent-self-evolution)
- [DSPy](https://github.com/stanfordnlp/dspy)
- [GEPA](https://github.com/gepa-ai/gepa)
