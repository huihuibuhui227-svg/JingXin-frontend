# 《衡才智析——多模态行为证据分析系统》前端（React 18 + Vite + TypeScript）

> **软著名**：`衡才智析——科研行为证据门控评估系统 V1.0` ｜ **核心理念**：「不给分，只给证据与缺口」

《衡才智析》多模态行为证据分析系统的 **Web 交互与可读证据界面**。围绕三大独立场景门户组织工作流：**「研思循证 · 科研行为过程分析」**、**「元智审辨 · AI 元能力与职业实训」** 与 **「时序观微 · 匿名个体纵向随访」**，在默认用户界面全面屏蔽内部服务端口与工程术语，将**五段式可读行为观察正文报告**置于报告页核心位置，配合设备自检、多通道实时监测、双层结构化证据、岗位能力缺口对照、个体内 EWMA/MAD 纵向轨迹及离线基准展板；**全程绝不渲染综合评分、能力等级或任何临床诊断词汇**。

## 技术栈

React 18 · TypeScript · Vite 4 · Ant Design 5 · Zustand · React Router · 原生 SVG 可视化（含 EWMA/MAD 纵向带与时间轴，无 Plotly）· Axios · Playwright + axe-core

## 常用命令

```bash
cd ~/JingXin/frontend
npm install                # 首次安装依赖
npm test                   # 70 项前端单测（node --test，~200 ms）
npx tsc --noEmit && npm run build  # TypeScript 类型检查 + 生产打包（dist/）
npm run dev                # 本地开发服务器（http://localhost:5173）
npm run preview -- --host 127.0.0.1 --port 5173   # 生产静态预览（同源代理 4 路后端，远程/Tailscale 访问推荐）
NO_PROXY=127.0.0.1,localhost node scripts/a11y.mjs # 全 18 条路由 Playwright + axe-core 无障碍实测
```

> **访问与权限边界**：
> - 页面通过同源 `/api` 与代理前缀优先转发至后端服务（开发与 `vite preview` 均可同源使用）；
> - 浏览器仅允许 `https://` 或 `http://localhost:5173` 打开摄像头与麦克风；
> - 跨网段通过 Tailscale DERP 中继访问时，建议使用**生产静态构建（`vite preview`）**获得最佳首屏响应。

## 3 大门户与核心路由

| 路由 | 页面 | 要点 |
|---|---|---|
| `/` | 三大门户总览 | 居中 Hero + 通道状态抽屉（隐藏内部端口细节）+ 三色区分入口卡（**研思循证 / 元智审辨 / 时序观微**）+ 共享工具栏 |
| `/hub/research` · `/research` · `/interview` · `/compare` | **研思循证**（核心科研场景） | 科研/面试多模态过程采录、多场同口径对比 `/compare`、理论依据与测量边界卡 |
| `/hub/metacognition` · `/career-mcp` · `/metacognition` | **元智审辨**（AI 审辨与求职实训） | 基于 Nelson & Narens (1990) / Tankelevitch et al. (CHI 2024) / Lee et al. (CHI 2025)：岗位能力画像检索、职位拆解、三阶段审辨实训、4 项规则指标与开发接口验证抽屉 |
| `/hub/followup` · `/followup` · `/followup/capture` | **时序观微**（匿名个体纵向 · 非医疗） | 基于 Molenaar (2004) / Fisher et al. (2018 PNAS) 非遍历性原则：锁定零原片落盘隐私模式、匿名随访建档与 EWMA/MAD 个体内变化轨迹 |
| `/report/:id` · `/report/latest` | 可读行为观察与证据报告 | 顶置 `.ax-narrative-paper` 五段式中文正文报告（支持**导师审阅版 / 个人成长版 / 追问与实训提纲**切换与本地 Qwen2.5-14B 润色）+ 场景切换 + 复核注记 + 41 项指标与双仪器明细 |
| `/reports` · `/analysis` · `/recordings` · `/export` · `/question-bank` · `/benchmarks` | 报告中心与通用工具 | 历史报告预览与单文件下载、实时信号监测、脱敏素材与回收站、三路原表导出、多模块题库管理与隔离科研基准展板 |

## 目录结构

```
src/
  App.tsx                 18 路由配置 + 衡才智析 Ant Design 5 主题令牌
  components/
    assessment/           AssessmentPage、CameraView、PreflightGate、RealtimeMetrics（客观物理遥测）
    common/               Header / Footer / BaseHubTemplate / ErrorBoundary / Loading
    recording/            LabelModal / ConsentModal / SaveGateModal / DevicePicker
    recordings/           RecordingDetail（回放/逐帧抽查/直达报告与导出）
    report/               ReportViewer、ReportCharts（含 RefereeStagePanel）、LongitudinalTrajectorySvg（EWMA+MAD 轨迹）、
                          EvidenceAuditPanels、InstrumentProvenance、L1IndicatorTable、DownloadButton
  hooks/                  useCamera / useSessionRecording / useAudioRecorder / useAssessment
  pages/                  Home / ResearchHubPage / MetacognitionHubPage / FollowupHubPage /
                          CareerMcpPage / MetacognitionAssessment / FollowupPage / FollowupCapture / CompareSessionsPage /
                          InterviewAssessment / ResearchAssessment / RealtimeAnalysis / ReportsList / ReportPage /
                          RecordingsPage / DataExportPage / QuestionBankPage / BenchmarksPage
  services/               api.ts（报告/可读解读/场景档案/Career MCP/纵向轨迹/复核注记/基准）、recordingsApi.ts
  store/                  assessmentStore.ts（Zustand）
  styles/                 tokens.css（三基地色彩与阅读排版令牌）/ global.css
  utils/                  constants.ts / analysisHealth.ts
scripts/
  a11y.mjs                Playwright + axe-core 全 18 路由无障碍自动检查脚本
```
