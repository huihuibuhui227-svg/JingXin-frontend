# JingXin 前端（React + Vite + TypeScript）

JingXin 多模态行为观测系统的**界面层**。采集面部/手势/语音数据，展示报告、素材、
数据导出与题库；**不产出评分或评级**（系统没有标定样本，口径见后端
`docs/汇报_系统整改与参数可信度_2026-10-26.md`）。

## 技术栈

React 18 · TypeScript · Vite 4 · Ant Design 5 · Zustand · React Router · Plotly（历史雷达图）· Axios

## 跑起来

```bash
cd ~/JingXin/frontend
npm install          # 首次
npm run dev          # http://localhost:5173
npm run build        # tsc + vite build
npx tsc --noEmit     # 类型检查（提交前跑）
```

> 页面通过 `window.location.hostname` 推断后端地址（只换端口，协议跟随页面）：
> 本地 `localhost:5173` → `localhost:8000/8001/8002/5000`；
> 远程 `https://gpuserver...:5173` → 同主机的 `:8000/:8001/:8002/:5000`。
> 浏览器要求 **https 或 localhost** 才能开摄像头/麦克风。
> 后端四个服务读 `CORS_ORIGINS`，换域名时两边要一起改。

## 页面

| 路由 | 页面 | 要点 |
|---|---|---|
| `/` | 首页 | 盘上实况（场次 / 报告数） |
| `/interview` `/research` | 面试 / 科研评估 | 标注 → 同意 → **设备自检**（脸/手/麦）→ 逐题作答 → 保存门禁 |
| `/analysis` | 实时分析 | 实时画面/AU/手势；不做正式评估 |
| `/reports` | 报告列表 | `科研评估报告 · 姓名`，打开 HTML 报告 |
| `/report/:id` `/report/latest` | 报告页 | 结构化报告 + 身份/两个时间（读 `/api/report/structured`） |
| `/recordings` | 录制素材 | 场次/回放/翻帧/删除（管理员）；只读视图**不带身份** |
| `/export` | 数据导出 | 三份 CSV、转写 TXT/CSV/JSON、按模块图表（PNG） |
| `/question-bank` | 题库 | 多套题库、当前生效、参考答案、导入 JSON/CSV |

## 设备自检（开录前）

`AssessmentPage` 在征询确定后、**铸号之前**打开 `PreflightGate`：

- 面部：检出且 `face_scale ≥ 0.20`（正常坐姿 0.25–0.47）；
- 手部：左右手至少一只进画面；
- 麦克风：流里有音轨；
- 探针请求 `POST /analyze?probe=1`（face :8000 / gesture :8002）——**只检测，不落帧、不写 CSV**；
- 三条全过才可"开始面试"；取消 → 不铸号、不留文件。

阈值在 `src/components/assessment/PreflightGate.tsx` 的 `FACE_MIN_SCALE`。

## 目录

```
src/
  App.tsx                 路由 + antd 主题令牌
  components/
    assessment/           评估页、CameraView、PreflightGate、指标/题目/作答
    recording/            标注/征询/保存门禁/停止确认
    recordings/           素材列表/详情/回放
    report/               报告渲染
    common/               Header/Footer/ErrorBoundary/Loading
  hooks/                  useCamera / useSessionRecording / useAudioRecorder / useAssessment
  pages/                  Home / Interview / Research / Realtime / Reports / ReportPage /
                          Recordings / DataExport / QuestionBank
  services/               api.ts（面板/分析服务）、recordingsApi.ts（素材/管理员）
  store/                  zustand
  utils/                  constants（端口/协议推断）、analysisHealth
```

## 注意

- **不要**在远程机器上用 `http://localhost:5173` —— 那指它自己；用 Tailscale 的 5173。
- 整场录像上传可能很慢（整场 100–200 MB；走 DERP 中继时约 0.5 MB/s），页面有"正在保存"但
  没有百分比；网络诊断见根 README「常见问题」。
- 报告页/素材页的许多数据受管理员密码保护（`sessionStorage`，关标签页即失效）。
