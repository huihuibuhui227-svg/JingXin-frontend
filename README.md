# 《衡才智析——多模态行为证据分析系统》前端（React 18 + Vite + TypeScript）

> **软著名**：`衡才智析——科研行为证据门控评估系统 V1.0` ｜ **核心理念**：「不给分，只给证据与缺口」 / 「仪器可以是黑盒，裁判必须是白盒」

《衡才智析》多模态行为证据分析系统的 **Web 交互与查账界面**。围绕 **「一核三基地（科研过程分析 · AI 元能力与求职 MCP · 长周期行为随访）」** 组织功能，负责设备自检、三模态采集监测、双层结构化证据与非评分模型裁判报告展示、岗位与 JD 缺口对照（MCP）、个体内纵向随访轨迹、按需本地辅助解读、脱敏素材管理及离线科研方法学基准展示；**绝不渲染综合评级分、能力雷达图或任何非客观推断标签**。

## 技术栈

React 18 · TypeScript · Vite 4 · Ant Design 5 · Zustand · React Router · 原生 SVG 可视化（已移除实时分析页 Plotly 依赖，`RealtimeAnalysis` 产物仅 `13.4 kB`）· Axios · Playwright + axe-core

## 常用命令

```bash
cd ~/JingXin/frontend
npm install                # 首次安装依赖
npm test                   # 68 项前端单测（node --test，~200 ms）
npx tsc --noEmit && npm run build  # TypeScript 类型检查 + 生产打包（dist/）
npm run dev                # 本地开发服务器（http://localhost:5173）
npm run preview -- --host 127.0.0.1 --port 5173   # 生产静态预览（同源代理 4 路后端，远程/Tailscale 访问推荐）
NO_PROXY=127.0.0.1,localhost node scripts/a11y.mjs # 全 15 条路由 Playwright + axe-core 无障碍实测
```

> **访问与权限边界**：
> - 页面通过同源 `/api` 与代理前缀优先转发（开发与 `vite preview` 下同源直连 `:5000` / `:8000` / `:8001` / `:8002`），并保留同主机端口回退（支持 `VITE_API_BASE_URL` 等环境变量覆盖）；
> - 浏览器仅允许 `https://`（如 `https://gpuserver.tail4ffce2.ts.net:5173`）或 `http://localhost:5173`（含 SSH 5 端口转发）打开摄像头与麦克风；
> - 若跨网段通过 Tailscale DERP 中继访问感到加载慢，请使用**生产静态构建（`vite preview`）**替代 `npm run dev`，或在同局域网使用 SSH 本地 5 端口转发（`5173 / 5000 / 8000 / 8001 / 8002`）。

## 页面与核心能力

| 路由 | 页面 | 要点 |
|---|---|---|
| `/` | 系统总览 | Hero 指标胶囊（含 31 场真 3D 姿态校准实况）+「一核三基地」声明式场景中心 + 四路服务探活 + 全部工作台入口 |
| `/interview` `/research` `/metacognition` `/followup/capture` | 四场景行为采集 | 3 步引导欢迎卡 → 标注 → 三档知情同意（含 `anonymous_kinematics_only` 零原始媒体落盘隐私模式）→ 设备自检 → 逐题采集 → 保存门禁 → 直达 `/report/:sid` |
| `/career-mcp` | AI 元能力与求职 MCP 中心 | 标准 JSON-RPC 2.0 协议台、10 类岗位画像检索、自定义 JD 拆解（可观测线索 vs 封停硬技能）、零匹配分会话证据对照与三阶段实训联动 |
| `/followup` | 长周期行为随访档案 | 非医疗声明、匿名随访编号建档、访次绑定、`LongitudinalTrajectorySvg`（$t_0$ 自基线、P25–P75 带、跨版本守卫与缺口断线） |
| `/compare` | 多场纵向对比工作台 | 基地一跨场次同代次并排核对、姿态模式对比与时序折线可视化 |
| `/analysis` | 实时监测台 | 三模态仪器健康灯、闲置态坐标虚线网格与通道硬件规格卡、帧率/人脸覆盖率/Web Audio 麦克风电平条与客观物理时序 SVG 曲线（非评分面板） |
| `/reports` | 报告中心 | 历史离线 HTML 报告列表（支持按会话号/文件名即时筛选、演示态自动脱敏、跳转 `/compare`）、在线预览与单文件下载 |
| `/report/:id` `/report/latest` | 结构化证据报告 | **三层协同披露 + 场景切换 + 复核闭环**——支持 `scene_profile` 热切、AI 审辨文本扩展卡片、管理员非打分「人工复核注记」抽屉、Layer 1–3 与 `:8081 Qwen2.5-14B` 按需辅助解读 |
| `/recordings` | 录制素材管理 | 公开只读脱敏视图（可直接点「查账」看匿名报告）；管理员密码解锁身份标注、录像回放、逐帧抽查与可逆回收站 |
| `/export` | 数据导出与原表复核 | 管理员鉴权；支持 `?sid=` 深链；三路原始 CSV、转写 TXT/CSV/JSON 与按模块 PNG 趋势图 |
| `/question-bank` | 题库管理 | 多套 `interview` / `research` / `metacognition` 题库、导入 JSON/CSV、管理员解锁写删与毫秒级本地语义检索（`/api/question-bank/llm-search`） |
| `/benchmarks` | 科研基准与方法学验证 | 只读原生 SVG 展示页（`GET /api/research/benchmarks`）：MIT / RecruitView / ChaLearn V2 与中英节奏迁移、3D 姿态矩阵校准（31 场）、去循环裁判 CV 与算力对比（零生产计分） |

## 设备自检（开录前）

`AssessmentPage` 与 `RealtimeAnalysis` 在授权确认后、**铸号之前**打开 `PreflightGate`：

- 面部：检出且 `face_scale ≥ 0.20`（2 帧防抖）；
- 手部：左右手至少一只进画面；
- 麦克风：实时 Web Audio 电平条 + 音轨可用校验；
- 探针走 `POST /analyze?probe=1`（face `:8000` / gesture `:8002`）——**只检测，不落帧、不写 CSV**；取消则不铸号、不留文件。

## 目录结构

```
src/
  App.tsx                 10 路由配置 + 衡才智析 Ant Design 5 主题令牌
  components/
    assessment/           AssessmentPage、CameraView、PreflightGate、RealtimeMetrics（客观物理遥测）
    recording/            LabelModal / ConsentModal / SaveGateModal / DevicePicker
    recordings/           RecordingDetail（回放/逐帧抽查/直达查账与导出）
    report/               ReportViewer、ReportCharts（原生 SVG 含 RefereeStagePanel）、EvidenceAuditPanels（Layer 2 手风琴）、
                          InstrumentProvenance、L1IndicatorTable、DownloadButton
    common/               Header / Footer / ErrorBoundary / Loading
  hooks/                  useCamera / useSessionRecording / useAudioRecorder / useAssessment
  pages/                  Home / Interview / Research / RealtimeAnalysis / ReportsList / ReportPage /
                          RecordingsPage / DataExportPage / QuestionBankPage / BenchmarksPage
  services/               api.ts（面板/分析/健康/本地助手/科研基准）、recordingsApi.ts（素材/管理员鉴权）
  store/                  assessmentStore.ts（Zustand）
  styles/                 tokens.css / global.css
  utils/                  constants.ts（同源代理与同主机端口推断 + 品牌常量）、analysisHealth.ts
scripts/
  a11y.mjs                Playwright + axe-core 全 10 路由无障碍自动检查脚本
```
