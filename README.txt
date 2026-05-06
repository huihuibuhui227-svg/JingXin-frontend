我来帮你分析整个项目，并生成一份详细的前端开发文档。让我先全面了解项目的结构和功能。




**已查看文件** *README.md*

**已查看文件** *app.py*

**已查看文件** *requirements.txt*

**已查看文件** *app.py*


让我继续查看更多的核心模块文件：




**已查看文件** *dashboard.html*

**已查看文件** *report_generator.py*

**已查看文件** *data_loader.py*

**已查看文件** *feature_engine.py*


让我继续查看其他关键模块：




**已查看文件** *research_mapper.py*

**已查看文件** *visualizer.py*

**已查看目录** 2 个结果

**已查看目录** 2 个结果


现在让我查看API接口文件：




**已查看文件** *app.py*

**已查看文件** *app.py*


现在让我查看一下语音模块的API：




**已查看目录** 2 个结果

**已查看文件** *app.py*


非常好！现在我已经全面了解了你的项目。让我为你创建一份详细的前端开发文档：

```markdown
# JingXin 多模态面试评估系统 - 前端开发文档

## 📋 目录
1. [项目概述](#项目概述)
2. [系统架构](#系统架构)
3. [后端API接口](#后端api接口)
4. [数据流与处理流程](#数据流与处理流程)
5. [前端技术栈建议](#前端技术栈建议)
6. [页面功能设计](#页面功能设计)
7. [核心功能模块](#核心功能模块)
8. [数据结构说明](#数据结构说明)
9. [开发路线图](#开发路线图)

---

## 项目概述

### 项目简介
JingXin是一个智能多模态面试评估系统，通过同时分析面试者的**面部表情**、**手势姿态**、**语音内容**和**眼动轨迹**，提供全面、客观的面试评估报告。

### 核心价值
- **多模态融合分析**: 整合视觉、听觉、行为等多维度数据
- **实时评估反馈**: 毫秒级数据处理与即时结果展示
- **科研能力量化**: 五大维度精准评估（认知效率、沟通流畅度、自信水平、逻辑思维、压力韧性）
- **可视化报告**: 自动生成交互式HTML评估报告

### 应用场景
- 企业招聘面试
- 研究生入学评估
- 科研项目选拔
- 心理辅导与情绪管理培训

---

## 系统架构

### 整体架构图
```

┌─────────────────────────────────────────────────────┐
│                  前端 Web 界面                        │
│  (React/Vue + Plotly.js + WebSocket)                │
└──────────────────┬──────────────────────────────────┘
                   │ HTTP/WebSocket
┌──────────────────▼──────────────────────────────────┐
│              Flask 总控平台 (app.py)                  │
│  - 路由管理                                          │
│  - 文件服务                                          │
│  - 任务调度                                          │
└──────┬──────────────┬──────────────┬────────────────┘
       │              │              │
┌──────▼──────┐ ┌────▼──────┐ ┌────▼──────────┐
│ 面部分析API  │ │手势分析API│ │ 语音交互API    │
│ (FastAPI)   │ │(FastAPI)  │ │ (FastAPI)     │
│ Port: 8000  │ │ Port:8001 │ │ Port: 8002    │
└──────┬──────┘ └────┬──────┘ └────┬──────────┘
       │              │              │
┌──────▼──────────────▼──────────────▼──────────────┐
│           核心分析引擎                              │
│  • face_expression/  - 面部表情与眼动分析          │
│  • gesture_analysis/ - 手势姿态分析                │
│  • voice_interaction/- 语音识别与评估              │
│  • report_frontend/  - 报告生成与可视化            │
└──────────────────┬────────────────────────────────┘
                   │
┌──────────────────▼────────────────────────────────┐
│              数据存储层                             │
│  • data/logs/     - CSV日志文件                    │
│  • data/output/   - HTML报告与图表                 │
│  • SQL Server     - 结构化数据(可选)               │
└───────────────────────────────────────────────────┘
```
### 技术栈详情

#### 后端
| 组件 | 技术 | 版本要求 | 用途 |
|------|------|----------|------|
| Web框架 | Flask | ≥2.0.0 | 主应用服务器 |
| API框架 | FastAPI | 最新 | 微服务API |
| 计算机视觉 | MediaPipe | ≥0.8.0 | 关键点检测 |
| 图像处理 | OpenCV | ≥4.5.0 | 图像预处理 |
| 语音识别 | Vosk | 0.22 | 中文ASR |
| 音频分析 | Librosa | ≥0.9.0 | 韵律特征提取 |
| 数据处理 | Pandas | ≥1.3.0 | 日志处理 |
| 数值计算 | NumPy | ≥1.21.0 | 矩阵运算 |
| 数据库 | pymssql | ≥2.2.5 | SQL Server连接 |

#### 前端（推荐）
| 组件 | 技术 | 版本要求 | 用途 |
|------|------|----------|------|
| 框架 | React 18 / Vue 3 | 最新 | UI构建 |
| 状态管理 | Redux / Pinia | 最新 | 全局状态 |
| 可视化 | Plotly.js | ≥2.0 | 图表渲染 |
| HTTP客户端 | Axios | ≥1.0 | API请求 |
| 实时通信 | Socket.io | ≥4.0 | WebSocket |
| UI组件库 | Ant Design / Element Plus | 最新 | 界面组件 |
| 路由 | React Router / Vue Router | 最新 | 页面路由 |
| 样式 | Tailwind CSS / SCSS | 最新 | 样式管理 |

---

## 后端API接口

### 1. Flask总控平台 API
**基础URL**: `http://localhost:5000`

#### 1.1 主页
```
http
GET /
```
**响应**: 返回dashboard.html页面

#### 1.2 获取文件列表
```
http
GET /api/files/<folder_name>
```
**参数**:
- `folder_name`: 文件夹名称（face_expression, gesture_analysis, voice_interaction）

**响应示例**:
```
json
[
  {
    "name": "face_au_log_20260420_093341.png",
    "url": "/output/face_expression/face_au_log_20260420_093341.png"
  }
]
```
#### 1.3 访问输出文件
```
http
GET /output/<path:filename>
```
**参数**:
- `filename`: 文件相对路径

**响应**: 文件内容（图片/HTML）

#### 1.4 触发模块运行
```
http
POST /api/run/<module>
```
**模块类型**:
- `face`: 面部特征提取
- `gesture`: 肢体分析
- `voice`: 语音评估
- `report`: 报告生成

**响应示例**:
```
json
{
  "status": "started",
  "message": "任务 [face] 已启动，请在后台查看日志或稍后刷新页面。"
}
```
---

### 2. 面部表情分析 API (FastAPI)
**基础URL**: `http://localhost:8000`

#### 2.1 健康检查
```
http
GET /health
```
**响应**:
```
json
{"status": "healthy"}
```
#### 2.2 分析上传图片
```
http
POST /analyze
Content-Type: multipart/form-data
```
**请求体**:
- `file`: 图片文件（JPG/PNG）

**响应示例**:
```
json
{
  "status": "success",
  "result": {
    "emotion": "happy",
    "features": {
      "focus_score": 0.85,
      "tension_score": 0.32,
      "symmetry_score": 0.78
    },
    "au_features": {
      "au_12": 0.9,
      "au_6": 0.7
    }
  }
}
```
---

### 3. 手势姿态分析 API (FastAPI)
**基础URL**: `http://localhost:8001`

#### 3.1 分析手势
```
http
POST /analyze
Content-Type: application/json
```
**请求体**:
```
json
{
  "image": "base64编码的图片字符串"
}
```
**响应示例**:
```
json
{
  "status": "success",
  "detected_hands": 2,
  "hand_score": 78.5,
  "shoulder_score": 82.3,
  "left_arm_score": 75.0,
  "right_arm_score": 76.5,
  "overall_score": 78.1,
  "emotion_state": "relaxed",
  "emoji": "😊",
  "feedback": "肢体语言自然放松"
}
```
#### 3.2 重置分析器
```
http
POST /reset
```
**响应**:
```
json
{"status": "success", "message": "分析器已重置"}
```
---

### 4. 语音交互 API (FastAPI)
**基础URL**: `http://localhost:8002`

#### 4.1 文本转语音
```
http
POST /tts
Content-Type: application/json
```
**请求体**:
```
json
{
  "text": "欢迎参加本次面试"
}
```
**响应**:
```
json
{"status": "success", "message": "语音播放已开始"}
```
#### 4.2 语音识别
```
http
POST /asr
Content-Type: multipart/form-data
```
**请求体**:
- `audio`: WAV文件（16kHz, 16bit, 单声道）

**响应**:
```
json
{
  "text": "我是计算机科学专业的学生"
}
```
#### 4.3 开始面试
```
http
POST /interview/start
```
**响应**:
```
json
{
  "status": "started",
  "question": "请简单介绍一下你自己"
}
```
#### 4.4 获取下一个问题
```
http
GET /interview/question
```
**响应**:
```
json
{
  "question": "你为什么选择这个专业？"
}
```
#### 4.5 提交文本回答
```
http
POST /interview/answer
Content-Type: application/json
```
**请求体**:
```
json
{
  "answer": "我选择计算机科学是因为..."
}
```
**响应**:
```
json
{"status": "success", "message": "回答已记录"}
```
#### 4.6 提交语音回答
```
http
POST /interview/answer_audio
Content-Type: multipart/form-data
```
**请求体**:
- `audio`: WAV文件

**响应**:
```
json
{
  "status": "success",
  "recognized_text": "我选择计算机科学是因为..."
}
```
#### 4.7 获取面试评估
```
http
GET /interview/evaluation
```
**响应示例**:
```
json
{
  "evaluation": {
    "core_competency": {"score": 85, "level": "优秀"},
    "problem_solving": {"score": 78, "level": "良好"},
    "teamwork": {"score": 82, "level": "优秀"},
    "communication": {"score": 80, "level": "良好"},
    "emotional_stability": {"score": 75, "level": "良好"}
  },
  "log_path": "data/logs/interview_emotion_log_20260420_093341.csv"
}
```
#### 4.8 科研评估接口
类似面试评估，路径为 `/research/*`：
- `POST /research/start` - 开始科研评估
- `GET /research/question` - 获取问题
- `POST /research/answer` - 提交文本回答
- `POST /research/answer_audio` - 提交语音回答
- `GET /research/evaluation` - 获取评估结果

---

## 数据流与处理流程

### 完整评估流程

```
mermaid
graph TB
    A[用户访问Web界面] --> B[选择评估场景]
    B --> C{场景类型}
    C -->|面试评估| D[启动面试流程]
    C -->|科研评估| E[启动科研流程]
    
    D --> F[摄像头采集视频]
    D --> G[麦克风采集音频]
    
    E --> F
    E --> G
    
    F --> H[面部表情分析]
    F --> I[手势姿态分析]
    F --> J[眼动追踪分析]
    
    G --> K[语音识别 ASR]
    K --> L[语音韵律分析]
    
    H --> M[特征提取]
    I --> M
    J --> M
    L --> M
    
    M --> N[心理特征引擎]
    N --> O[科研能力映射]
    O --> P[五维评分计算]
    
    P --> Q[生成可视化图表]
    Q --> R[生成HTML报告]
    R --> S[展示给用户]
```
### 数据流转详解

#### 1. 数据采集阶段
```
javascript
// 前端伪代码
const startAssessment = async () => {
  // 1. 启动摄像头
  const stream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true
  });
  
  // 2. 实时捕获帧
  videoElement.onframe = async (frame) => {
    // 发送到面部分析API
    const faceResult = await analyzeFace(frame);
    
    // 发送到手势分析API
    const gestureResult = await analyzeGesture(frame);
    
    // 更新UI
    updateRealtimeDisplay(faceResult, gestureResult);
  };
  
  // 3. 音频流处理
  audioProcessor.ondata = async (audioChunk) => {
    const text = await recognizeSpeech(audioChunk);
    submitAnswer(text);
  };
};
```
#### 2. 特征提取阶段
```
python
# 后端处理流程
def process_multimodal_data():
    # 加载最新日志
    loader = LogDataLoader()
    data = loader.get_fused_latest_data()
    
    # 提取心理特征
    engine = PsychologicalFeatureEngine(data)
    features = engine.extract_all_features()
    
    # 映射到科研能力
    mapper = ResearchCapabilityMapper()
    result = mapper.map_features_to_scores(features)
    
    return result
```
#### 3. 报告生成阶段
```
python
def generate_report():
    generator = ReportGenerator()
    report_path = generator.generate_report()
    
    # 返回报告路径给前端
    return {"report_url": f"/output/{report_path}"}
```
---

## 前端技术栈建议

### 推荐方案：React + TypeScript

#### 项目结构
```

jingxin-frontend/
├── public/
│   └── index.html
├── src/
│   ├── components/
│   │   ├── common/           # 通用组件
│   │   │   ├── Header.tsx
│   │   │   ├── Footer.tsx
│   │   │   └── Loading.tsx
│   │   ├── assessment/       # 评估相关组件
│   │   │   ├── CameraView.tsx        # 摄像头视图
│   │   │   ├── RealtimeMetrics.tsx   # 实时指标显示
│   │   │   ├── QuestionCard.tsx      # 问题卡片
│   │   │   └── AnswerInput.tsx       # 回答输入框
│   │   ├── visualization/    # 可视化组件
│   │   │   ├── RadarChart.tsx        # 雷达图
│   │   │   ├── EvidenceBar.tsx       # 证据链条形图
│   │   │   ├── GazeHeatmap.tsx       # 眼动热力图
│   │   │   └── TimelineChart.tsx     # 时间轴图表
│   │   └── report/           # 报告组件
│   │       ├── ReportViewer.tsx      # 报告查看器
│   │       └── DownloadButton.tsx    # 下载按钮
│   ├── pages/
│   │   ├── Home.tsx                  # 首页
│   │   ├── InterviewAssessment.tsx   # 面试评估页
│   │   ├── ResearchAssessment.tsx    # 科研评估页
│   │   ├── RealtimeAnalysis.tsx      # 实时分析页
│   │   └── ReportPage.tsx            # 报告页
│   ├── services/
│   │   ├── api.ts                    # API封装
│   │   ├── websocket.ts              # WebSocket连接
│   │   └── mediaCapture.ts           # 媒体捕获
│   ├── store/
│   │   ├── assessmentStore.ts        # 评估状态
│   │   ├── userStore.ts              # 用户状态
│   │   └── uiStore.ts                # UI状态
│   ├── hooks/
│   │   ├── useCamera.ts              # 摄像头Hook
│   │   ├── useAudioRecorder.ts       # 录音Hook
│   │   └── useAssessment.ts          # 评估逻辑Hook
│   ├── types/
│   │   ├── assessment.ts             # 评估类型定义
│   │   └── api.ts                    # API类型定义
│   ├── utils/
│   │   ├── constants.ts              # 常量
│   │   ├── helpers.ts                # 工具函数
│   │   └── validators.ts             # 验证器
│   ├── styles/
│   │   ├── global.css
│   │   └── variables.scss
│   ├──App.tsx
│   └── main.tsx
├── package.json
└── tsconfig.json
```
#### 依赖包
```
json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.0.0",
    "@reduxjs/toolkit": "^1.9.0",
    "react-redux": "^8.0.0",
    "axios": "^1.4.0",
    "socket.io-client": "^4.7.0",
    "plotly.js": "^2.25.0",
    "react-plotly.js": "^2.6.0",
    "antd": "^5.0.0",
    "@ant-design/icons": "^5.0.0",
    "dayjs": "^1.11.0",
    "zustand": "^4.4.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@types/plotly.js": "^2.12.0",
    "typescript": "^5.0.0",
    "vite": "^4.4.0",
    "@vitejs/plugin-react": "^4.0.0",
    "sass": "^1.63.0"
  }
}
```
---

## 页面功能设计

### 1. 首页 (Home)
**路由**: `/`

**功能**:
- 系统介绍与特性展示
- 选择评估场景（面试/科研）
- 历史报告列表
- 快速开始入口

**UI布局**:
```

┌──────────────────────────────────────┐
│         Logo + 导航栏                 │
├──────────────────────────────────────┤
│                                      │
│    🎯 JingXin 多模态评估系统          │
│    副标题：AI驱动的智能面试评估        │
│                                      │
│    [📹 开始面试评估] [🔬 开始科研评估] │
│                                      │
├──────────────────────────────────────┤
│  📊 最近报告                          │
│  ┌──────┐ ┌──────┐ ┌──────┐         │
│  │报告1 │ │报告2 │ │报告3 │         │
│  └──────┘ └──────┘ └──────┘         │
├──────────────────────────────────────┤
│         页脚信息                      │
└──────────────────────────────────────┘
```
### 2. 面试评估页 (InterviewAssessment)
**路由**: `/interview`

**功能**:
- 实时视频预览
- 问题展示与语音播报
- 文本回答/语音回答切换
- 实时情绪指标显示
- 进度跟踪

**UI布局**:
```

┌─────────────────────────────────────────────┐
│  ← 返回          面试评估          进度 3/10 │
├──────────────┬──────────────────────────────┤
│              │                              │
│  📹 摄像头    │  ❓ 问题卡片                  │
│              │  "请介绍一下你的研究经历"      │
│  ┌────────┐  │                              │
│  │        │  │  [🔊 播放问题]               │
│  │ 视频流  │  │                              │
│  │        │  ├──────────────────────────────┤
│  └────────┘  │  💬 回答区域                  │
│              │                              │
│  实时指标:    │  ┌────────────────────────┐  │
│  😊 情绪: 开心│  │ 文本输入框              │  │
│  👁️ 专注: 85%│  │                        │  │
│  🖐️ 手势: 自然│  └────────────────────────┘  │
│              │  [🎤 语音回答] [✉️ 提交]    │
├──────────────┴──────────────────────────────┤
│  时间轴: ●────●────○────○────○             │
└─────────────────────────────────────────────┘
```
### 3. 科研评估页 (ResearchAssessment)
**路由**: `/research`

**功能**: 与面试评估类似，但问题内容针对科研场景

### 4. 实时分析页 (RealtimeAnalysis)
**路由**: `/analysis`

**功能**:
- 多维度实时数据可视化
- 面部AU单元动态图
- 手势轨迹追踪
- 眼动热力图
- 语音波形与韵律

**UI布局**:
```

┌─────────────────────────────────────────────┐
│  ← 返回          实时分析                    │
├─────────────────────────────────────────────┤
│  ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│  │面部表情   │ │手势姿态   │ │眼动轨迹   │    │
│  │[Plotly]  │ │[Plotly]  │ │[Plotly]  │    │
│  └──────────┘ └──────────┘ └──────────┘    │
├─────────────────────────────────────────────┤
│  ┌──────────────────┐ ┌──────────────────┐  │
│  │语音韵律分析       │ │五维能力雷达图     │  │
│  │[波形图]          │ │[雷达图]          │  │
│  └──────────────────┘ └──────────────────┘  │
├─────────────────────────────────────────────┤
│  📊 实时数据流                               │
│  AU12: ████░░ 0.8  | 紧张度: ██░░░░ 0.3    │
│  流畅度: █████░ 0.9  | 自信度: ████░░ 0.7   │
└─────────────────────────────────────────────┘
```
### 5. 报告页 (ReportPage)
**路由**: `/report/:id`

**功能**:
- 完整评估报告展示
- 五维能力雷达图
- 分维度证据链
- 眼动轨迹回放
- 下载报告（PDF/HTML）
- 分享报告

**UI布局**:
```

┌─────────────────────────────────────────────┐
│  ← 返回列表      评估报告       [⬇️ 下载]   │
├─────────────────────────────────────────────┤
│  📊 综合评分: 82.5 (良好)                    │
│  ┌─────────────────────────────────────┐    │
│  │     雷达图 (五维能力模型)            │    │
│  │                                     │    │
│  └─────────────────────────────────────┘    │
├─────────────────────────────────────────────┤
│  📝 深度分析报告                             │
│  ┌─────────────────────────────────────┐    │
│  │ 1. 情绪状态与抗压能力                │    │
│  │    候选人的面部紧张度均值为 0.32...   │    │
│  └─────────────────────────────────────┘    │
│  ┌─────────────────────────────────────┐    │
│  │ 2. 肢体语言与自信心                  │    │
│  │    ...                               │    │
│  └─────────────────────────────────────┘    │
├─────────────────────────────────────────────┤
│  🔍 分维度证据链                             │
│  [逻辑思维] [压力韧性] [沟通流畅度] ...      │
│  ┌─────────────────────────────────────┐    │
│  │ 证据链条形图                         │    │
│  └─────────────────────────────────────┘    │
├─────────────────────────────────────────────┤
│  👁️ 眼动行为分析                             │
│  ┌─────────────────────────────────────┐    │
│  │ 眼动热力图 + 轨迹                    │    │
│  └─────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```
---

## 核心功能模块

### 1. 媒体捕获模块 (mediaCapture.ts)

```
typescript
import { useState, useEffect, useRef } from 'react';

interface UseMediaCaptureProps {
  onFrame?: (frame: Blob) => void;
  onAudio?: (audioChunk: Blob) => void;
  frameRate?: number;
}

export const useMediaCapture = ({
  onFrame,
  onAudio,
  frameRate = 30
}: UseMediaCaptureProps) => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  // 启动摄像头
  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: true
      });
      
      setStream(mediaStream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      
      // 开始帧捕获
      captureFrames();
      
      // 开始音频录制
      startAudioRecording(mediaStream);
      
    } catch (error) {
      console.error('摄像头启动失败:', error);
      throw error;
    }
  };

  // 捕获视频帧
  const captureFrames = () => {
    if (!canvasRef.current || !videoRef.current) return;
    
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext('2d');
    
    const capture = () => {
      if (!isRecording) return;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx?.drawImage(video, 0, 0);
      
      canvas.toBlob((blob) => {
        if (blob && onFrame) {
          onFrame(blob);
        }
      }, 'image/jpeg', 0.8);
      
      setTimeout(capture, 1000 / frameRate);
    };
    
    capture();
  };

  // 音频录制
  const startAudioRecording = (mediaStream: MediaStream) => {
    const audioStream = new MediaStream(mediaStream.getAudioTracks());
    const mediaRecorder = new MediaRecorder(audioStream, {
      mimeType: 'audio/webm;codecs=opus'
    });
    
    mediaRecorderRef.current = mediaRecorder;
    
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0 && onAudio) {
        onAudio(event.data);
      }
    };
    
    mediaRecorder.start(1000); // 每秒发送一次数据
  };

  // 停止录制
  const stopRecording = () => {
    setIsRecording(false);
    
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }
  };

  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, []);

  return {
    stream,
    isRecording,
    videoRef,
    canvasRef,
    startCamera,
    startRecording: () => setIsRecording(true),
    stopRecording
  };
};
```
### 2. API服务模块 (api.ts)

```
typescript
import axios from 'axios';

const BASE_URL = 'http://localhost:5000';
const FACE_API_URL = 'http://localhost:8000';
const GESTURE_API_URL = 'http://localhost:8001';
const VOICE_API_URL = 'http://localhost:8002';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000
});

// 面部分析API
export const faceApi = {
  analyzeImage: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await axios.post(`${FACE_API_URL}/analyze`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    
    return response.data;
  }
};

// 手势分析API
export const gestureApi = {
  analyzeGesture: async (imageBase64: string) => {
    const response = await axios.post(`${GESTURE_API_URL}/analyze`, {
      image: imageBase64
    });
    
    return response.data;
  },
  
  resetAnalyzers: async () => {
    const response = await axios.post(`${GESTURE_API_URL}/reset`);
    return response.data;
  }
};

// 语音交互API
export const voiceApi = {
  // 文本转语音
  textToSpeech: async (text: string) => {
    const response = await axios.post(`${VOICE_API_URL}/tts`, { text });
    return response.data;
  },
  
  // 语音识别
  speechToText: async (audioFile: File) => {
    const formData = new FormData();
    formData.append('audio', audioFile);
    
    const response = await axios.post(`${VOICE_API_URL}/asr`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    
    return response.data;
  },
  
  // 面试评估
  interview: {
    start: async () => {
      const response = await axios.post(`${VOICE_API_URL}/interview/start`);
      return response.data;
    },
    
    getQuestion: async () => {
      const response = await axios.get(`${VOICE_API_URL}/interview/question`);
      return response.data;
    },
    
    submitAnswer: async (answer: string) => {
      const response = await axios.post(`${VOICE_API_URL}/interview/answer`, {
        answer
      });
      return response.data;
    },
    
    submitAudioAnswer: async (audioFile: File) => {
      const formData = new FormData();
      formData.append('audio', audioFile);
      
      const response = await axios.post(
        `${VOICE_API_URL}/interview/answer_audio`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      
      return response.data;
    },
    
    getEvaluation: async () => {
      const response = await axios.get(`${VOICE_API_URL}/interview/evaluation`);
      return response.data;
    }
  },
  
  // 科研评估
  research: {
    start: async () => {
      const response = await axios.post(`${VOICE_API_URL}/research/start`);
      return response.data;
    },
    
    getQuestion: async () => {
      const response = await axios.get(`${VOICE_API_URL}/research/question`);
      return response.data;
    },
    
    submitAnswer: async (answer: string) => {
      const response = await axios.post(`${VOICE_API_URL}/research/answer`, {
        answer
      });
      return response.data;
    },
    
    submitAudioAnswer: async (audioFile: File) => {
      const formData = new FormData();
      formData.append('audio', audioFile);
      
      const response = await axios.post(
        `${VOICE_API_URL}/research/answer_audio`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      
      return response.data;
    },
    
    getEvaluation: async () => {
      const response = await axios.get(`${VOICE_API_URL}/research/evaluation`);
      return response.data;
    }
  }
};

// 总控平台API
export const dashboardApi = {
  runModule: async (module: 'face' | 'gesture' | 'voice' | 'report') => {
    const response = await axios.post(`/api/run/${module}`);
    return response.data;
  },
  
  getFiles: async (folderName: string) => {
    const response = await axios.get(`/api/files/${folderName}`);
    return response.data;
  }
};

export default api;
```
### 3. 状态管理模块 (assessmentStore.ts)

```
typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AssessmentState {
  // 评估状态
  scenario: 'interview' | 'research' | null;
  currentQuestionIndex: number;
  questions: string[];
  answers: Array<{
    question: string;
    answer: string;
    timestamp: Date;
    audioFile?: Blob;
  }>;
  
  // 实时数据
  realtimeMetrics: {
    emotion?: string;
    focusScore?: number;
    tensionScore?: number;
    handScore?: number;
    shoulderScore?: number;
    fluency?: number;
  };
  
  // 评估结果
  evaluationResult: any | null;
  reportUrl: string | null;
  
  // Actions
  setScenario: (scenario: 'interview' | 'research') => void;
  setQuestions: (questions: string[]) => void;
  addAnswer: (answer: AssessmentState['answers'][number]) => void;
  updateRealtimeMetrics: (metrics: Partial<AssessmentState['realtimeMetrics']>) => void;
  setEvaluationResult: (result: any) => void;
  setReportUrl: (url: string) => void;
  resetAssessment: () => void;
}

export const useAssessmentStore = create<AssessmentState>()(
  persist(
    (set) => ({
      scenario: null,
      currentQuestionIndex: 0,
      questions: [],
      answers: [],
      realtimeMetrics: {},
      evaluationResult: null,
      reportUrl: null,
      
      setScenario: (scenario) => set({ scenario }),
      
      setQuestions: (questions) => set({ 
        questions,
        currentQuestionIndex: 0 
      }),
      
      addAnswer: (answer) => set((state) => ({
        answers: [...state.answers, answer],
        currentQuestionIndex: state.currentQuestionIndex + 1
      })),
      
      updateRealtimeMetrics: (metrics) => set((state) => ({
        realtimeMetrics: { ...state.realtimeMetrics, ...metrics }
      })),
      
      setEvaluationResult: (result) => set({ evaluationResult: result }),
      
      setReportUrl: (url) => set({ reportUrl: url }),
      
      resetAssessment: () => set({
        scenario: null,
        currentQuestionIndex: 0,
        questions: [],
        answers: [],
        realtimeMetrics: {},
        evaluationResult: null,
        reportUrl: null
      })
    }),
    {
      name: 'assessment-storage',
      partialize: (state) => ({
        answers: state.answers,
        evaluationResult: state.evaluationResult
      })
    }
  )
);
```
### 4. 可视化组件示例 (RadarChart.tsx)

```
typescript
import React, { useEffect, useRef } from 'react';
import Plot from 'react-plotly.js';

interface RadarChartProps {
  dimensions: {
    logical_thinking: number;
    stress_resilience: number;
    communication_fluency: number;
    confidence_level: number;
    cognitive_efficiency: number;
  };
  title?: string;
}

export const RadarChart: React.FC<RadarChartProps> = ({
  dimensions,
  title = '科研能力五维模型'
}) => {
  const categories = [
    '逻辑思维',
    '压力韧性',
    '沟通流畅度',
    '自信水平',
    '认知效率',
    '逻辑思维' // 闭合图形
  ];
  
  const scores = [
    dimensions.logical_thinking,
    dimensions.stress_resilience,
    dimensions.communication_fluency,
    dimensions.confidence_level,
    dimensions.cognitive_efficiency,
    dimensions.logical_thinking // 闭合图形
  ];
  
  const baselines = [60, 60, 60, 60, 60, 60];

  return (
    <Plot
      data={[
        {
          type: 'scatterpolar',
          r: scores,
          theta: categories,
          fill: 'toself',
          name: '候选人得分',
          line: { color: '#2E86AB' },
          fillcolor: 'rgba(46, 134, 171, 0.4)'
        },
        {
          type: 'scatterpolar',
          r: baselines,
          theta: categories,
          fill: 'none',
          name: '常模基准',
          line: { color: '#6c757d', dash: 'dot' }
        }
      ]}
      layout={{
        title: {
          text: title,
          font: { size: 18 }
        },
        polar: {
          radialaxis: {
            visible: true,
            range: [0, 100]
          }
        },
        height: 500,
        showlegend: true
      }}
      config={{ responsive: true }}
    />
  );
};
```
---

## 数据结构说明

### 1. 评估结果数据结构

```
typescript
interface EvaluationResult {
  total_score: number;           // 总分 (0-100)
  total_level: string;           // 等级 (卓越/优秀/良好/合格/待提升)
  
  dimensions: {
    logical_thinking: DimensionResult;
    stress_resilience: DimensionResult;
    communication_fluency: DimensionResult;
    confidence_level: DimensionResult;
    cognitive_efficiency: DimensionResult;
  };
  
  summary_narrative: string;     // 总结叙述
  
  model_metadata: {
    version: string;
    timestamp: string;
  };
}

interface DimensionResult {
  display_name: string;          // 维度名称
  description: string;           // 维度描述
  algorithm: string;             // 算法说明
  score: number;                 // 得分 (0-100)
  level: string;                 // 等级
  narrative: string;             // 详细分析
  simple_narrative: string;      // 简要分析
  evidence_chain: EvidenceItem[]; // 证据链
  positive_factors: string[];    // 优势因素
  negative_factors: string[];    // 待改进因素
  confidence: string;            // 置信度 (高/中/低)
  matched_indicators: string;    // 匹配指标数
  stats: Record<string, {
    val: number;
    percentile: number;
  }>;
}

interface EvidenceItem {
  feature: string;               // 特征名
  human_name: string;            // 人类可读名称
  raw_value: number;             // 原始值
  normalized_score: number;      // 归一化分数
  contribution: number;          // 贡献值
  status: string;                // 状态 (强支撑/弱支撑/中性)
  direction: string;             // 方向 (正向/反向)
  weight: number;                // 权重
  percentile: number;            // 百分位
}
```
### 2. 实时指标数据结构

```
typescript
interface RealtimeMetrics {
  // 面部指标
  face?: {
    emotion: string;             // 情绪 (happy/sad/angry/etc.)
    au_features: {
      au_1?: number;
      au_4?: number;
      au_6?: number;
      au_12?: number;
    };
    focus_score: number;         // 专注度 (0-1)
    tension_score: number;       // 紧张度 (0-1)
    symmetry_score: number;      // 对称性 (0-1)
    gaze_stability: number;      // 视线稳定性 (0-1)
    eye_contact_ratio: number;   // 眼神接触比例 (0-1)
  };
  
  // 手势指标
  gesture?: {
    detected_hands: number;      // 检测到的手数
    hand_score: number;          // 手势分数 (0-100)
    shoulder_score: number;      // 肩部分数 (0-100)
    left_arm_score: number;      // 左臂分数 (0-100)
    right_arm_score: number;     // 右臂分数 (0-100)
    jitter: number;              // 抖动程度
  };
  
  // 语音指标
  voice?: {
    fluency: number;             // 流畅度 (0-100)
    pitch_variation: number;     // 语调变化
    energy: number;              // 能量
    pause_duration: number;      // 停顿时长
    speech_ratio: number;        // 说话占比
  };
}
```
### 3. 日志数据结构

```
typescript
interface FaceLogEntry {
  timestamp: string;
  au_1?: number;
  au_4?: number;
  au_6?: number;
  au_12?: number;
  emotion?: string;
  focus_score?: number;
  tension_score?: number;
  symmetry_score?: number;
  left_iris_x?: number;
  left_iris_y?: number;
  right_iris_x?: number;
  right_iris_y?: number;
  gaze_direction_x?: number;
  gaze_direction_y?: number;
  gaze_deviation?: number;
}

interface GestureLogEntry {
  timestamp: string;
  hand_landmarks?: number[];
  pose_landmarks?: number[];
  hand_score?: number;
  shoulder_score?: number;
  arm_score?: number;
  jitter?: number;
}

interface VoiceLogEntry {
  timestamp: string;
  text?: string;
  emotion?: string;
  pitch_mean?: number;
  energy_mean?: number;
  fluency_score?: number;
  pause_duration?: number;
  speech_ratio?: number;
}
```
---

## 开发路线图

### Phase 1: 基础框架搭建 (1-2周)
- [ ] 初始化React项目结构
- [ ] 配置TypeScript、Vite、路由
- [ ] 安装并配置UI组件库（Ant Design）
- [ ] 搭建基础页面布局（Header、Footer、Sidebar）
- [ ] 实现路由导航
- [ ] 配置Axios和API服务层

### Phase 2: 核心功能开发 (2-3周)
- [ ] 实现媒体捕获模块（摄像头+麦克风）
- [ ] 开发面试评估页面
  - [ ] 视频预览组件
  - [ ] 问题展示组件
  - [ ] 回答输入组件（文本+语音）
  - [ ] 实时指标显示
- [ ] 开发科研评估页面（复用面试评估组件）
- [ ] 集成面部分析API
- [ ] 集成手势分析API
- [ ] 集成语音交互API

### Phase 3: 可视化与报告 (2周)
- [ ] 集成Plotly.js
- [ ] 开发雷达图组件
- [ ] 开发证据链条形图组件
- [ ] 开发眼动热力图组件
- [ ] 开发实时分析页面
- [ ] 开发报告查看页面
- [ ] 实现报告下载功能

### Phase 4: 状态管理与优化 (1周)
- [ ] 实现Zustand状态管理
- [ ] 添加数据持久化
- [ ] 实现WebSocket实时通信
- [ ] 优化性能（懒加载、代码分割）
- [ ] 添加错误边界和异常处理

### Phase 5: 测试与部署 (1周)
- [ ] 编写单元测试
- [ ] 端到端测试
- [ ] 浏览器兼容性测试
- [ ] 性能优化
- [ ] 部署配置
- [ ] 文档完善

---

## 关键注意事项

### 1. 跨域问题 (CORS)
确保所有FastAPI服务都配置了CORS：
```
python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 生产环境应指定具体域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```
### 2. 媒体权限
- 必须在HTTPS环境下使用摄像头和麦克风（localhost除外）
- 需要处理用户拒绝权限的情况
- 提供清晰的权限使用说明

### 3. 性能优化
- 视频帧采样率不宜过高（建议1-2秒/帧）
- 使用Web Worker处理大量数据
- 图表数据分页加载
- 使用虚拟滚动处理长列表

### 4. 用户体验
- 提供加载状态提示
- 实时显示处理进度
- 友好的错误提示
- 支持断点续传

### 5. 数据安全
- 敏感数据加密传输
- 本地存储数据脱敏
- 定期清理临时文件
- 遵守隐私保护法规

---

## 快速开始示例

### 1. 创建React项目
```
bash
npm create vite@latest jingxin-frontend -- --template react-ts
cd jingxin-frontend
npm install
```
### 2. 安装依赖
```
bash
npm install axios plotly.js react-plotly.js zustand antd @ant-design/icons
npm install -D @types/plotly.js
```
### 3. 启动开发服务器
```
bash
# 后端服务
python app.py                    # Flask: http://localhost:5000
cd face_expression/api && python app.py    # FastAPI: http://localhost:8000
cd gesture_analysis/api && python app.py   # FastAPI: http://localhost:8001
cd voice_interaction/api && python app.py  # FastAPI: http://localhost:8002

# 前端服务
npm run dev                      # Vite: http://localhost:5173
```
---

## 总结

本文档提供了基于JingXin后端系统开发前端Web页面的完整指南。主要内容包括：

1. **系统架构理解**: 清晰的后端API结构和数据流
2. **技术栈选择**: React + TypeScript + Plotly.js的最佳实践
3. **页面设计**: 5个核心页面的详细UI/UX设计
4. **代码示例**: 关键功能模块的实现代码
5. **数据结构**: 完整的TypeScript类型定义
6. **开发路线**: 分阶段的实施计划

按照本指南开发，可以快速构建一个功能完善、用户体验优秀的多模态面试评估系统前端界面。

**下一步行动**:
1. 根据Phase 1开始搭建项目基础框架
2. 优先实现核心的评估流程功能
3. 逐步完善可视化和报告功能
4. 持续优化性能和用户体验

祝开发顺利！🚀
```


这份文档已经非常全面地介绍了你的项目，并为前端开发提供了详细的指导。你可以直接将这份文档保存为 `FRONTEND_DEVELOPMENT_GUIDE.md` 文件，作为前端开发的参考手册。