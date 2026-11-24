# 《衡才智析——多模态行为证据披露系统》前端（React 18 + Vite + TypeScript）

> **软著名**：`衡才智析——科研行为证据门控评估系统 V1.0` ｜ **核心理念**：「不给分，只给证据与缺口」 / 「仪器可以是黑盒，裁判必须是白盒」

《衡才智析》多模态行为证据披露系统的 **Web 交互与查账界面**。负责设备自检、三模态采集监测、双层结构化证据与非评分模型裁判报告展示、按需本地辅助解读、脱敏素材管理、原表数据导出、题库检索管理及离线科研方法学基准展示；**绝不渲染综合评分、能力雷达图或心理/情绪诊断标签**。

## 技术栈

React 18 · TypeScript · Vite 4 · Ant Design 5 · Zustand · React Router · 原生 SVG 可视化（已移除实时分析页 Plotly 依赖，`RealtimeAnalysis` 产物仅 `13.4 kB`）· Axios · Playwright + axe-core

## 常用命令

```bash
cd ~/JingXin/frontend
npm install                # 首次安装依赖
npm test                   # 63 项前端单测（node --test，~200 ms）
npx tsc --noEmit && npm run build  # TypeScript 类型检查 + 生产打包（dist/）
npm run dev                # 本地开发服务器（http://localhost:5173）
npm run preview -- --host 127.0.0.1 --port 5173   # 生产静态预览（同源代理 4 路后端，远程/Tailscale 访问推荐）
NO_PROXY=127.0.0.1,localhost node scripts/a11y.mjs # 全 10 条路由 Playwright + axe-core 无障碍实测
```

> **访问与权限边界**：
> - 页面通过同源 `/api` 与代理前缀优先转发（开发与 `vite preview` 下同源直连 `:5000` / `:8000` / `:8001` / `:8002`），并保留同主机端口回退（支持 `VITE_API_BASE_URL` 等环境变量覆盖）；
> - 浏览器仅允许 `https://`（如 `https://gpuserver.tail4ffce2.ts.net:5173`）或 `http://localhost:5173`（含 SSH 5 端口转发）打开摄像头与麦克风；
> - 若跨网段通过 Tailscale DERP 中继访问感到加载慢，请使用**生产静态构建（`vite preview`）**替代 `npm run dev`，或在同局域网使用 SSH 本地 5 端口转发（`5173 / 5000 / 8000 / 8001 / 8002`）。

## 页面与核心能力

| 路由 | 页面 | 要点 |
|---|---|---|
| `/` | 系统总览 | Hero 指标胶囊 + 实时探活四路服务与活体引擎状态（`3D 矩阵`/`Parselmouth`/`RTMW`/`Qwen2.5-14B`）+ 三列盘上与科研实况 + 4×2 对称工作台入口 |
| `/interview` `/research` | 面试 / 科研采集 | 3 步引导欢迎卡 → 标注 → 知情同意 → **设备自检（PreflightGate）** → 逐题语音/视频采集 → 保存门禁 → 直达 `/report/:sid` |
| `/analysis` | 实时监测台 | 三模态仪器健康灯、闲置态坐标虚线网格与通道硬件规格卡、帧率/人脸覆盖率/Web Audio 麦克风电平条与客观物理时序 SVG 曲线（非评分面板） |
| `/reports` | 报告中心 | 历史离线 HTML 报告列表（支持按会话号/文件名即时筛选，演示态自动脱敏）、一键跳转「结构化查账」、在线预览与单文件下载 |
| `/report/:id` `/report/latest` | 结构化证据报告 | **三层协同披露**——主视野 `RefereeStagePanel`（HMM+PELT 宏观阶段时间轴、变点与 Split Conformal 白盒归因）+ Layer 1（10 秒导读、跨模态覆盖、ASR 置信度、14/14 三段覆盖、原生 SVG 五维覆盖条与逐题离散度小倍数图、5 维证据卡）+ Layer 2 折叠查账手风琴（全量 41 项、T1/T2/T3 参数、治理台账、双仪器 & Part C 3D 姿态校准对照、`feature-layer-v2` 动力学、GMM 基线对比与 41 项仪器来源）+ `:8081` `Qwen2.5-14B` 按需「本地辅助解读」抽屉 |
| `/recordings` | 录制素材管理 | 公开只读脱敏视图（可直接点「查账」看匿名报告）；管理员密码解锁身份标注、录像回放、逐帧抽查与可逆回收站 |
| `/export` | 数据导出与原表复核 | 管理员鉴权；支持 `?sid=` 深链；三路原始 CSV、转写 TXT/CSV/JSON 与按模块 PNG 趋势图 |
| `/question-bank` | 题库管理 | 多套面试/科研题库、导入 JSON/CSV、未保存防丢提示、管理员解锁写删与毫秒级本地语义检索（`/api/question-bank/llm-search`） |
| `/benchmarks` | 科研基准与方法学验证 | 只读原生 SVG 展示页（`GET /api/research/benchmarks`）：MIT / RecruitView / ChaLearn V2 与中英节奏迁移、3D 姿态矩阵校准效果、去循环裁判 CV 与 7 维遥测消融、常驻 CPU vs Tesla P40 并发算力决策（严格不参与实际计分） |

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
