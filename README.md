# 《衡才智析——多模态行为证据分析系统》前端（React 18 + Vite + TypeScript）

> **软著名**：`衡才智析——科研行为证据门控评估系统 V1.0` ｜ **核心理念**：「不给分，只给证据与缺口」

《衡才智析》多模态行为证据分析系统的 **Web 交互与可读证据界面**。围绕三大独立场景构建专属工作空间：**「研思循证 · 科研行为过程分析」**、**「元智审辨 · AI 元能力与职业实训」** 与 **「时序观微 · 匿名个体纵向随访」**，并参照 `getdesign.md`（`VoltAgent/awesome-design-md`）为总门户与三大模块定制四套差异化视觉体系与动态切境引擎：默认屏蔽内部服务端口与底层工程术语，将**五段式可读行为观察正文报告**置于报告页核心位置，配合设备自检、多通道实时监测、双层结构化证据、岗位能力缺口对照、个体内 EWMA/MAD 纵向轨迹及离线基准展板；**全程绝不渲染综合评分、能力等级或任何临床诊断词汇**。

## 技术栈

React 18 · TypeScript · Vite 4 · Ant Design 5（动态 `ConfigProvider` 算法/令牌切换）· Zustand · React Router · 原生主题化 SVG 可视化（含 EWMA/MAD 纵向带与时间轴，无 Plotly）· Axios · Playwright + axe-core

## 常用命令

```bash
cd ~/JingXin/frontend
npm install                # 首次安装依赖
npm test                   # 73 项前端单测（25 套件，node --test）
npx tsc --noEmit && npm run build  # TypeScript 类型检查 + 生产打包（dist/）
npm run dev                # 本地开发服务器（http://localhost:5173）
npm run preview -- --host 127.0.0.1 --port 5173   # 生产静态预览（同源代理 4 路后端，远程/Tailscale 访问推荐）
NO_PROXY=127.0.0.1,localhost node scripts/a11y.mjs # 全 18 条路由 Playwright + axe-core 无障碍实测
```

> **访问与权限边界**：
> - 页面通过同源 `/api` 与代理前缀优先转发至后端服务（开发与 `vite preview` 均可同源使用）；
> - 浏览器仅允许 `https://` 或 `http://localhost:5173` 打开摄像头与麦克风；
> - 跨网段通过 Tailscale DERP 中继访问时，建议使用**生产静态构建（`vite preview`）**获得最佳首屏响应。

## 四套视觉体系与核心路由

顶部单行上下文导航搭载 **`ThemeSwitcher`（「风格」切境浮层）**：默认随当前路由自动切换所属视觉体系（`document.documentElement.dataset.designTheme` 联动 CSS 变量作用域与 AntD 5 `defaultAlgorithm` / `darkAlgorithm`），亦支持一键手动切换并预览全站任意页面。权威参考规范源文件保存在 `docs/design-systems/*.DESIGN.md`。

| 路由 | 所属体系 | 页面与要点 |
|---|---|---|
| `/` · 工具页 | **Vercel**（极简架构网格） | 1px 结构网格与十字准星、非对称双栏总览与**三场景实时切境舞台**，外加报告中心/多场对比/录制素材/题库/科研基准入口 |
| `/hub/research` · `/research` · `/interview` · `/compare` | **Linear**（深邃曜石精密暗仪） | `theme.darkAlgorithm` 曜石暗底与 1px 细线面板、科研/面试多模态采录、多场同口径纵向对照 `/compare` 与方法学封停账本 |
| `/hub/metacognition` · `/career-mcp` · `/metacognition` | **Claude**（温润象牙衬线编校室） | 象牙纸面与常规字重衬线标题、标志性 `#181715` 暗炭审辨展示框、岗位能力检索与 JD 拆解、三阶段审辨实训 |
| `/hub/followup` · `/followup` · `/followup/capture` | **Oura**（森绿亚麻静谧风） | `#224228` 深森绿静谧头带、极轻衬线标题、锁定零原片落盘隐私模式、匿名随访建档与 EWMA/MAD 个体内变化轨迹 |
| `/report/:id` · `/report/latest` | 随 `?scene_profile=` 自动适配 | 顶置 `.ax-narrative-paper` 五段式中文正文报告（支持**导师审阅版 / 个人成长版 / 追问与实训提纲**切换与本地 Qwen2.5-14B 润色）+ 复核注记 + 双仪器明细 |

## 目录结构

```
docs/
  design-systems/         源自 VoltAgent/awesome-design-md 的 4 份原版 DESIGN.md 规范
src/
  App.tsx                 18 路由配置 + DesignThemeProvider 动态注入 AntD ThemeConfig
  theme/                  designThemes.ts（四风格令牌与路由映射）、ThemeContext.tsx（状态与 View Transitions）
  components/
    assessment/           AssessmentPage、CameraView、PreflightGate、RealtimeMetrics（客观物理遥测）
    common/               Header（单行自适应）、ModuleSubnav、ThemeSwitcher、Footer、ErrorBoundary、Loading
    recording/            LabelModal / ConsentModal / SaveGateModal / DevicePicker
    recordings/           RecordingDetail（回放/逐帧抽查/直达报告与导出）
    report/               ReportViewer、ReportCharts（含 RefereeStagePanel）、LongitudinalTrajectorySvg（主题化 EWMA+MAD 轨迹）、
                          EvidenceAuditPanels、InstrumentProvenance、L1IndicatorTable、DownloadButton
  hooks/                  useCamera / useSessionRecording / useAudioRecorder / useAssessment
  pages/                  Home / ResearchHubPage / MetacognitionHubPage / FollowupHubPage /
                          CareerMcpPage / MetacognitionAssessment / FollowupPage / FollowupCapture / CompareSessionsPage /
                          InterviewAssessment / ResearchAssessment / RealtimeAnalysis / ReportsList / ReportPage /
                          RecordingsPage / DataExportPage / QuestionBankPage / BenchmarksPage
  services/               api.ts（报告/可读解读/场景档案/Career MCP/纵向轨迹/复核注记/基准）、recordingsApi.ts
  store/                  assessmentStore.ts（Zustand）
  styles/                 tokens.css（基础令牌）/ themes.css（Vercel/Linear/Claude/Oura 四作用域变量）/
                          world-linear.css / global.css
  utils/                  constants.ts / analysisHealth.ts
scripts/
  a11y.mjs                Playwright + axe-core 全 18 路由无障碍自动检查脚本
```
