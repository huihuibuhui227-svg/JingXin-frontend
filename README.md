# 《衡才智析——多模态行为证据披露系统》前端（React 18 + Vite + TypeScript）

> **软著名**：`衡才智析——科研行为证据门控评估系统 V1.0` ｜ **核心理念**：「不给分，只给证据与缺口」 / 「仪器可以是黑盒，裁判必须是白盒」

《衡才智析》多模态行为证据披露系统的 **Web 交互与查账界面**。负责设备自检、三模态采集监测、双层结构化证据报告展示、按需本地辅助解读、脱敏素材管理、原表数据导出与题库检索管理；**绝不渲染综合评分、能力雷达图或心理/情绪诊断标签**。

## 技术栈

React 18 · TypeScript · Vite 4 · Ant Design 5 · Zustand · React Router · 原生 SVG 可视化（已移除实时分析页 Plotly 依赖，`RealtimeAnalysis` 产物仅 `13.4 kB`）· Axios · Playwright + axe-core

## 常用命令

```bash
cd ~/JingXin/frontend
npm install                # 首次安装依赖
npm test                   # 63 项前端单测（node --test，~200 ms）
npm run build              # TypeScript 类型检查 + 生产打包（dist/）
npm run dev                # 本地开发服务器（http://localhost:5173）
npm run preview -- --host 127.0.0.1 --port 5173   # 生产静态预览（远程/Tailscale 访问推荐，较 dev 快 10 倍以上）
NO_PROXY=127.0.0.1,localhost node scripts/a11y.mjs # 全 9 条路由 Playwright + axe-core 无障碍实测
```

> **访问与权限边界**：
> - 页面通过 `window.location` 同主机同协议推断 4 个后端端口（`:5000` / `:8000` / `:8001` / `:8002`），可用 `VITE_API_BASE_URL` 等环境变量覆盖；
> - 浏览器仅允许 `https://`（如 `https://gpuserver.tail4ffce2.ts.net:5173`）或 `http://localhost:5173`（含 SSH 5 端口转发）打开摄像头与麦克风；
> - 若跨网段通过 Tailscale DERP 中继访问感到加载慢，请使用**生产静态构建（`vite preview`）**替代 `npm run dev`，或在同局域网使用 SSH 本地 5 端口转发（`5173 / 5000 / 8000 / 8001 / 8002`）。

## 页面与核心能力

| 路由 | 页面 | 要点 |
|---|---|---|
| `/` | 系统总览 | 三层透明架构卡 + 实时探活四路本地服务与 FunASR 状态灯（`/api/system/health`）+ 盘上实况 |
| `/interview` `/research` | 面试 / 科研采集 | 标注 → 知情同意 → **设备自检（PreflightGate）** → 逐题语音/视频采集 → 保存门禁 → 直达 `/report/:sid` |
| `/analysis` | 实时监测台 | 三模态仪器健康灯、帧率/人脸覆盖率/Web Audio 麦克风电平条与客观物理时序 SVG 曲线（非评分面板） |
| `/reports` | 报告中心 | 历史离线 HTML 报告列表（演示态自动脱敏）、一键跳转「结构化查账」、在线预览与单文件下载 |
| `/report/:id` `/report/latest` | 结构化证据报告 | **双层结构**——Layer 1（10 秒导读、跨模态覆盖门控、ASR 置信度披露、14/14 三段覆盖、原生 SVG 五维覆盖条形图与逐题离散度小倍数图、全中文 5 维证据卡）+ Layer 2（全量 41 项查账、T1/T2/T3 参数登记、治理台账、自监督信号质检参考、可折叠 41 项仪器来源）+ 按需「本地辅助解读」抽屉 |
| `/recordings` | 录制素材管理 | 公开只读脱敏视图（可直接点「查账」看匿名报告）；管理员密码解锁身份标注、录像回放、逐帧抽查与可逆回收站 |
| `/export` | 数据导出与原表复核 | 管理员鉴权；支持 `?sid=` 深链；三路原始 CSV、转写 TXT/CSV/JSON 与按模块 PNG 趋势图 |
| `/question-bank` | 题库管理 | 多套面试/科研题库、导入 JSON/CSV、未保存防丢提示、管理员解锁写删与毫秒级本地语义检索（`/api/question-bank/llm-search`） |

## 设备自检（开录前）

`AssessmentPage` 与 `RealtimeAnalysis` 在授权确认后、**铸号之前**打开 `PreflightGate`：

- 面部：检出且 `face_scale ≥ 0.20`（2 帧防抖）；
- 手部：左右手至少一只进画面；
- 麦克风：实时 Web Audio 电平条 + 音轨可用校验；
- 探针走 `POST /analyze?probe=1`（face `:8000` / gesture `:8002`）——**只检测，不落帧、不写 CSV**；取消则不铸号、不留文件。

## 目录结构

```
src/
  App.tsx                 9 路由配置 + 衡才智析 Ant Design 5 主题令牌
  components/
    assessment/           AssessmentPage、CameraView、PreflightGate、RealtimeMetrics（客观物理遥测）
    recording/            LabelModal / ConsentModal / SaveGateModal / DevicePicker
    recordings/           RecordingDetail（回放/逐帧抽查/直达查账与导出）
    report/               ReportViewer、ReportCharts（原生 SVG）、EvidenceAuditPanels（Layer 2 手风琴）、
                          InstrumentProvenance、L1IndicatorTable、DownloadButton
    common/               Header / Footer / ErrorBoundary / Loading
  hooks/                  useCamera / useSessionRecording / useAudioRecorder / useAssessment
  pages/                  Home / Interview / Research / RealtimeAnalysis / ReportsList / ReportPage /
                          RecordingsPage / DataExportPage / QuestionBankPage
  services/               api.ts（面板/分析/健康/本地助手）、recordingsApi.ts（素材/管理员鉴权）
  store/                  assessmentStore.ts（Zustand）
  styles/                 tokens.css / global.css
  utils/                  constants.ts（同主机同协议端口推断与品牌常量）、analysisHealth.ts
scripts/
  a11y.mjs                Playwright + axe-core 全 9 路由无障碍自动检查脚本
```
