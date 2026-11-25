import axios from 'axios';
import { API_BASE_URL, FACE_API_URL, GESTURE_API_URL, VOICE_API_URL } from '@/utils/constants';
import { getAdminToken } from '@/services/recordingsApi';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000
});

const adminHeaders = (): Record<string, string> => {
  const token = getAdminToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

let sessionId: string | null = null;
let discardToken: string | null = null;

export type PrivacyConsentMode = 'full' | 'audio_only' | 'anonymous_kinematics_only';
let currentPrivacyMode: PrivacyConsentMode | null = null;

export const setPrivacyMode = (mode: PrivacyConsentMode | null): void => {
  currentPrivacyMode = mode;
};

export const getPrivacyMode = (): PrivacyConsentMode | null => currentPrivacyMode;

const privacyHeaders = (override?: PrivacyConsentMode | null): Record<string, string> => {
  const effective = override ?? currentPrivacyMode;
  return effective ? { 'X-Privacy-Mode': effective } : {};
};

// 清掉旧版本残留在 localStorage 里的 UUID —— 不清的话老用户会一直用旧值,id 永远对不上
localStorage.removeItem('assessment_session_id');
localStorage.removeItem('face_session_id');

export const getSessionId = (): string | null => sessionId;
export const getDiscardToken = (): string | null => discardToken;

export const setSessionId = (id: string | null, token?: string | null): void => {
  sessionId = id;
  if (token !== undefined) discardToken = token;
  if (!id) discardToken = null;
};

/** 给 URL 追一个 session_id 参数;**还没开始会话时不追**(而不是带上一个编出来的 id)。
 *  `override` 用于"要读的/要跑的不是当前这场"的调用(报告页可以指定另一场);
 *  缺省(传 `undefined`)就是当前这场。 */
const withSession = (url: string, override: string | null = sessionId): string =>
  override ? `${url}${url.includes('?') ? '&' : '?'}session_id=${override}` : url;

export const faceApi = {
  analyzeImage: async (file: Blob | File, opts?: { privacyMode?: PrivacyConsentMode | null }) => {
    const formData = new FormData();

    // 如果是 Blob，转换为 File
    const fileToUpload = file instanceof File ? file : new File([file], 'frame.jpg', {
      type: 'image/jpeg',
      lastModified: Date.now()
    });

    formData.append('file', fileToUpload);

    // session_id 由 withSession 拼(还没开始会话时不带)—— fps 固定 30
    const response = await axios.post(
      withSession(`${FACE_API_URL}/analyze?fps=30`),
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
          ...privacyHeaders(opts?.privacyMode),
        }
      }
    );

    return response.data;
  }
};


export const gestureApi = {
  analyzeGesture: async (file: Blob | File, opts?: { privacyMode?: PrivacyConsentMode | null }) => {
    const formData = new FormData();

    // 如果是 Blob，转换为 File
    const fileToUpload = file instanceof File ? file : new File([file], 'frame.jpg', {
      type: 'image/jpeg',
      lastModified: Date.now()
    });

    formData.append('file', fileToUpload);

    const response = await axios.post(
      withSession(`${GESTURE_API_URL}/analyze`),
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
          ...privacyHeaders(opts?.privacyMode),
        }
      }
    );

    return response.data;
  },

  resetAnalyzers: async () => {
    // 带 id 才是"重置**这场**" —— 不带的话后端走的是"清掉所有会话"那条路
    const response = await axios.post(withSession(`${GESTURE_API_URL}/reset`));
    return response.data;
  }
};

export const voiceApi = {
  textToSpeech: async (text: string) => {
    const response = await axios.post(`${VOICE_API_URL}/tts`, { text });
    return response.data;
  },

  /**
   * 语音识别(ASR)。
   *
   * ⚠️ **`record: false` = 这次识别是「预览」,不是「回答」** —— 服务端不会把它
   *    算进本场的 transcript.json(仍照常留存原始字节、照常回识别文本)。
   *    录音后先识别一遍显示给面试官看,提交时**同一份音频**再走
   *    `/interview/answer_audio`(权威的那条)⟹ 不标这一下,同一句话会在账本里
   *    存两遍(2026-09-26 实测:24 段 = 12 段 × 2,连时间戳都一样),而 M3 要用
   *    逐字时间戳算**语速/停顿/反应潜伏期** —— 翻倍是静默的。
   *    `record` 缺省 true:与从前逐字一致(纯 ASR 调用方不受影响)。
   */
  speechToText: async (
    audioFile: File,
    opts?: { record?: boolean; privacyMode?: PrivacyConsentMode | null }
  ) => {
    const formData = new FormData();
    formData.append('audio', audioFile);

    const record = opts?.record !== false;
    // 带 id:这次识别会累积进**该会话**的 transcript.json(不带则落 NONE,报告侧排除)
    const response = await axios.post(
      withSession(`${VOICE_API_URL}/asr${record ? '' : '?record=false'}`), formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        ...privacyHeaders(opts?.privacyMode),
      }
    });

    return response.data;
  },

  interview: {
    start: async () => {
      const response = await axios.post(`${VOICE_API_URL}/interview/start`);
      setSessionId(response.data?.session_id ?? null, response.data?.discard_token ?? null);
      return response.data;
    },

    getQuestion: async () => {
      const response = await axios.get(withSession(`${VOICE_API_URL}/interview/question`));
      return response.data;
    },

    submitAnswer: async (answer: string) => {
      const response = await axios.post(withSession(`${VOICE_API_URL}/interview/answer`), {
        answer
      });
      return response.data;
    },

    submitAudioAnswer: async (audioFile: File, opts?: { privacyMode?: PrivacyConsentMode | null }) => {
      const formData = new FormData();
      formData.append('audio', audioFile);

      const response = await axios.post(
        withSession(`${VOICE_API_URL}/interview/answer_audio`),
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            ...privacyHeaders(opts?.privacyMode),
          }
        }
      );

      return response.data;
    },

    getEvaluation: async () => {
      const response = await axios.get(withSession(`${VOICE_API_URL}/interview/evaluation`));
      return response.data;
    }
  },

  research: {
    start: async (module: 'research' | 'metacognition' | 'followup' = 'research') => {
      const q = module && module !== 'research' ? `?module=${encodeURIComponent(module)}` : '';
      const response = await axios.post(`${VOICE_API_URL}/research/start${q}`);
      setSessionId(response.data?.session_id ?? null, response.data?.discard_token ?? null);
      return response.data;
    },

    getQuestion: async () => {
      const response = await axios.get(withSession(`${VOICE_API_URL}/research/question`));
      return response.data;
    },

    submitAnswer: async (answer: string) => {
      const response = await axios.post(withSession(`${VOICE_API_URL}/research/answer`), {
        answer
      });
      return response.data;
    },

    submitAudioAnswer: async (audioFile: File, opts?: { privacyMode?: PrivacyConsentMode | null }) => {
      const formData = new FormData();
      formData.append('audio', audioFile);

      const response = await axios.post(
        withSession(`${VOICE_API_URL}/research/answer_audio`),
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            ...privacyHeaders(opts?.privacyMode),
          }
        }
      );

      return response.data;
    },

    getEvaluation: async () => {
      const response = await axios.get(withSession(`${VOICE_API_URL}/research/evaluation`));
      return response.data;
    }
  }
};

/** 会话级留存端点(voice :8001)要 `session_id`,而且它走的是**路径参数** ——
 *  别拿 `withSession` 拼(那个拼的是 `?session_id=`,是另外三个服务的形态)。 */
const requireSessionId = (what: string): string => {
  const sid = getSessionId();
  if (!sid) {
    // 不编一个 id:没有会话就**没有**可上报的对象,编一个只会把数据写进 NONE 桶
    // (报告侧整体排除 NONE)⟹ 看着成功、其实什么都没有。
    throw new Error(`尚未开始会话,无法${what}`);
  }
  return sid;
};

// ── M2.6:原始媒体留存 + 提问时刻(spec §5.3 / §5.6)──────────────────────
export const sessionApi = {
  /**
   * 上传本场**原生音视频**(`useCamera` 里 MediaRecorder 录的 `camera.webm`)。
   *
   * ⚠️ 刻意不用上面那个 `api` 实例:它 `timeout: 30000`,而整场录像按 R5 实测的
   *    码率(≈172 KB/s)可以有几百 MB —— 慢链路上 30 秒会把一次**合法**上传掐断,
   *    后果是这一场的原生录像整个没有。这里显式 `timeout: 0`(不设上限)。
   * ⚠️ 重复上传**覆盖**服务端同名文件,而账本各留一行(sha 各不同)⟹ 覆盖有据可查。
   */
  uploadMedia: async (video: Blob, opts?: { privacyMode?: PrivacyConsentMode | null }) => {
    const sid = requireSessionId('上传本场原生视频');
    const formData = new FormData();
    formData.append('file', video, 'camera.webm');   // 字段名必须是 file(spec §5.3)
    const response = await axios.post(
      `${VOICE_API_URL}/session/${sid}/media`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
          ...privacyHeaders(opts?.privacyMode),
        },
        timeout: 0,
      }
    );
    return response.data;
  },

  /**
   * 记下本场的**标注**(场次序号 / 姓名 / 学号 / 院系)→ 服务端落 `label.json`。
   *
   * 为什么必须走服务端:标注得**存在服务器上** —— 换台电脑打开也查得到。那是
   * localStorage 顶不了的事(那是"在这台电脑上记得",不是"记下来了")。
   *
   * ⚠️ 服务端会回**拼好的** `label`,界面显示它,别在本地再拼一遍:
   *    拼法只允许有一处定义(`session_meta.compose_label`)。
   * ⚠️ 标注**不进** `session_id`:报告侧只认 `_log_{日期}_{时刻}[_4位hex]` 这个
   *    文件名形态,塞进去会让每份日志都匹配不上 ⟹ 报告一份都加载不到。
   *    所以它是**另存的一份**,不碰 id、不碰目录名。
   * ⚠️ 同一会话再调一次 = **覆盖**(打错一个字要能改)。
   */
  setLabel: async (fields: {
    serial: string; name: string; student_id: string; department: string;
    consent?: PrivacyConsentMode;
  }) => {
    const sid = requireSessionId('上报本场标注');
    const response = await axios.post(`${VOICE_API_URL}/session/${sid}/label`, fields);
    return response.data;
  },

  /**
   * 上报一道题的提问窗口 —— `response_latency` 只此一途(spec §3.9 / §5.6)。
   *
   * ⚠️ 时刻是**墙钟秒**。JS 的 `Date.now()` 是**毫秒**,直接发会被服务端的量程闸
   *    400 掉(`session_meta._validate_window`,容差 1 天),而那条报错就是冲着
   *    这个写的。**换算由调用方做**(`/1000`)。
   * ⚠️ `qid` 是**题目原文**:题库没有 id(见 `session_meta` 模块开头)。
   */
  reportQuestion: async (window: {
    qid: string; index: number; ask_start: number; ask_end: number;
  }) => {
    const sid = requireSessionId('上报提问时刻');
    const response = await axios.post(`${VOICE_API_URL}/session/${sid}/question`, {
      qid: window.qid,
      index: Math.trunc(window.index),   // 服务端要非负整数,且显式拒 bool
      ask_start: window.ask_start,
      ask_end: window.ask_end,
    });
    return response.data;
  },
};

export interface SystemHealthResponse {
  status: 'healthy' | 'degraded' | 'offline';
  brand: string;
  subtitle: string;
  software_name: string;
  admin_configured: boolean;
  is_admin: boolean;
  checked_at: string;
  services: Record<string, {
    ok: boolean;
    status: string;
    latency_ms: number;
    url: string;
    asr_endpoint?: string;
    asr_reachable?: boolean;
    backend?: string;
    supported_backends?: string[];
    pitch_backend?: string;
    vad_backend?: string;
    live_pitch_backend?: string;
    live_vad_backend?: string;
    whisper_conf_ready?: boolean;
    landmarker_3d_matrix?: boolean;
    blendshapes_count?: number;
    live_framing?: boolean | string;
    error?: string;
  }>;
}

export type ReportAssistMode = 'narrative_review' | 'participant_feedback' | 'interview_guide' | 'summary';

export interface ReportAssistSection {
  title: string;
  body: string;
}

export interface ReportLlmAssistResponse {
  status: string;
  session_id: string | null;
  mode: ReportAssistMode;
  content: string;
  sections?: ReportAssistSection[];
  audience_label?: string;
  scene_profile_id?: string;
  reading_time_min?: number;
  source: 'local_llm' | 'deterministic_fallback';
  model: string;
  fallback_reason: string | null;
  redline_verified: boolean;
  watermark: string;
  latency_ms: number;
}

export interface QuestionSearchResponse {
  status: string;
  module: string;
  query: string;
  expanded_query: string;
  source: string;
  total_candidates: number;
  hits: Array<{
    bank_id: string;
    bank_name: string;
    index: number;
    question: string;
    reference_answer: string;
    is_active: boolean;
    similarity: number;
    matched_terms: string[];
  }>;
  watermark: string;
  latency_ms: number;
}

export interface BenchmarkModelMacroRow {
  model: string;
  pearson_r?: number | null;
  spearman_rho?: number | null;
  rmse?: number | null;
  mae?: number | null;
  acc_1_minus_mae?: number | null;
}

export interface BlendshapeStatsBand {
  mean?: number | null;
  median?: number | null;
  p25?: number | null;
  p75?: number | null;
  min?: number | null;
  max?: number | null;
}

export interface ResearchBenchmarksResponse {
  status: string;
  research_only: boolean;
  scoring_participation: boolean;
  boundary_note?: string;
  multicorpus: {
    available: boolean;
    generated_at?: string;
    extraction?: {
      total_clips_succeeded?: number;
      clips_per_sec?: number;
      workers?: number;
    };
    mit?: {
      n_interviews?: number;
      n_participants?: number;
      cv_scheme?: string;
      best_model?: string;
      models?: BenchmarkModelMacroRow[];
      gpu_mlp_hardware?: {
        device_name?: string;
        torch_version?: string;
        dtype?: string;
        elapsed_sec?: number;
        peak_vram_mb?: number;
        available?: boolean;
      };
    };
    recruitview?: {
      cv_scheme?: string;
      track_a_n_clips?: number;
      track_a_n_users?: number;
      track_a_models?: BenchmarkModelMacroRow[];
      track_b_n_clips?: number;
      track_b_n_users?: number;
      track_b_best_model?: string;
      track_b_models?: BenchmarkModelMacroRow[];
    };
    chalearn?: {
      split_counts?: { train?: number; val?: number; test?: number };
      n_total_features?: number;
      best_model?: string;
      models?: BenchmarkModelMacroRow[];
      best_model_dimensions?: Array<{
        key: string;
        pearson_r?: number | null;
        spearman_rho?: number | null;
        acc_1_minus_mae?: number | null;
      }>;
    };
    regime_transfer?: {
      shared_features?: string[];
      chinese_corpus?: {
        n_sessions?: number;
        n_sessions_with_voice?: number;
        n_windows?: number;
      };
      english_corpus?: {
        n_clips?: number;
        breakdown?: Record<string, number>;
      };
      regimes?: Record<string, {
        val_silhouette_mean?: number;
        silhouette_on_chinese?: number;
        ari_vs_chinese_ref?: number;
        nmi_vs_chinese_ref?: number;
        state_agreement_vs_chinese_ref?: number;
        chinese_state_distribution?: Record<string, number>;
      }>;
    };
  };
  blendshape_calibration: {
    available: boolean;
    generated_at?: string;
    corpus_summary?: {
      total_sessions?: number;
      available_sessions?: number;
      unavailable_sessions?: number;
      pose_mode_counts?: {
        '3d_matrix'?: number;
        '2d_legacy'?: number;
        unavailable?: number;
      };
      constructs_summary?: Record<string, {
        label?: string;
        n_valid_sessions?: number;
        raw_rho?: BlendshapeStatsBand;
        calibrated_rho?: BlendshapeStatsBand;
        rho_delta?: BlendshapeStatsBand;
        pose_r2?: BlendshapeStatsBand;
        counts_by_eligibility?: Record<string, number>;
      }>;
    };
  };
  referee_ml: {
    available: boolean;
    trained_at?: string;
    scoring_participation?: boolean;
    non_scoring_guarantee?: string;
    dataset?: {
      n_real_sessions?: number;
      n_real_windows?: number;
      n_real_sessions_with_voice_series?: number;
      n_synthetic_boundary_calibration?: number;
      synthetic_usage_note?: string;
      real_stage_distribution?: Record<string, number>;
    };
    stage_segmentation?: {
      model_type?: string;
      cv_scheme?: string;
      flicker_reduction_pct?: number;
      full_corpus_flicker_reduction_pct?: number;
      hmm_mean_dwell_sec?: number;
      gmm_mean_dwell_sec?: number;
      cross_fold_viterbi_ari_mean?: number;
      cross_fold_viterbi_agreement_mean?: number;
      pelt_mean_changepoints_per_session?: number;
      pelt_median_ms_per_session?: number;
    };
    evidence_gate?: {
      model_type?: string;
      cv_scheme?: string;
      supervision_protocol?: string;
      supervision_note_plain?: string;
      cv_accuracy?: number;
      cv_macro_f1?: number;
      empirical_conformal_coverage?: number;
      target_coverage?: number;
      mean_conformal_set_size?: number;
      uncertainty_escalation_rate?: number;
      ood_auroc_mean?: number;
      ood_auroc_std?: number;
      confusion_matrix?: number[][] | { labels?: string[]; matrix?: number[][] };
      non_circular_raw_telemetry_ablation?: {
        n_features?: number;
        features?: string[];
        cv_accuracy?: number;
        cv_macro_f1?: number;
        empirical_conformal_coverage?: number;
        ood_auroc_mean?: number;
        note?: string;
      } | Record<string, unknown>;
    };
    cpu_runtime?: {
      benchmark_session_windows?: number;
      warm_inference_ms_median?: number;
      warm_inference_ms_p95?: number;
      standalone_inference_ms_median?: number;
    };
  };
  gpu_vs_cpu: {
    available: boolean;
    generated_at?: string;
    hardware?: {
      gpu_tested?: string;
      fp16_tensor_core_available?: boolean;
      precision_used?: string;
    };
    cpu_referee?: {
      n_sessions_seq?: number;
      total_windows_seq?: number;
      cpu_full_evaluate_ms_median?: number;
      cpu_full_evaluate_ms_p95?: number;
      cpu_model_core_single_ms_median?: number;
      cpu_batch128_ms_median?: number;
      cpu_batch128_sess_per_sec?: number;
      cpu_batch256_ms_median?: number;
      cpu_batch256_sess_per_sec?: number;
    };
    gpu_neural_sequence_referee?: {
      device?: string;
      gpu_name?: string;
      torch_version?: string;
      precision?: string;
      architecture?: string;
      cv_agreement_with_hmm_mean?: number;
      cv_agreement_std?: number;
      cold_torch_cuda_init_ms?: number;
      gpu_single_e2e_ms_median?: number;
      gpu_single_kernel_ms_median?: number;
      gpu_batch128_e2e_ms_median?: number;
      gpu_batch128_sess_per_sec?: number;
      gpu_batch256_e2e_ms_median?: number;
      gpu_batch256_sess_per_sec?: number;
      train_peak_vram_mb?: number;
    };
    comparison?: {
      single_session_gpu_vs_cpu_model_core_ratio?: number;
      batch256_gpu_speedup_over_cpu?: number;
      conclusion_plain?: string;
    };
  };
}

export const dashboardApi = {
  runModule: async (module: 'report' | 'report_live' | 'voice_series', sessionId?: string | null) => {
    const response = await axios.post(
      withSession(`${API_BASE_URL}/api/run/${module}`, sessionId),
      null,
      { headers: adminHeaders() }
    );
    return response.data;
  },

  getFiles: async (folderName: string) => {
    const response = await axios.get(`${API_BASE_URL}/api/files/${folderName}`, {
      headers: adminHeaders(),
    });
    return response.data;
  },

  getStructuredReport: async (sessionId?: string | null, sceneProfile?: string | null) => {
    let url = withSession(`${API_BASE_URL}/api/report/structured`, sessionId);
    if (sceneProfile) {
      url += `${url.includes('?') ? '&' : '?'}scene_profile=${encodeURIComponent(sceneProfile)}`;
    }
    const response = await axios.get(url, { headers: adminHeaders() });
    return response.data;
  },

  getSystemHealth: async (): Promise<SystemHealthResponse> => {
    const response = await axios.get(`${API_BASE_URL}/api/system/health`, {
      headers: adminHeaders(),
      timeout: 5000,
    });
    return response.data;
  },

  getResearchBenchmarks: async (): Promise<ResearchBenchmarksResponse> => {
    const response = await axios.get(`${API_BASE_URL}/api/research/benchmarks`, {
      headers: adminHeaders(),
      timeout: 10000,
    });
    return response.data;
  },

  reportLlmAssist: async (params: {
    session_id?: string | null;
    mode: ReportAssistMode;
    use_llm?: boolean;
    scene_profile?: string;
    refresh?: boolean;
  }): Promise<ReportLlmAssistResponse> => {
    const response = await axios.post(`${API_BASE_URL}/api/report/llm-assist`, params, {
      headers: adminHeaders(),
      timeout: 80000,
    });
    return response.data;
  },

  searchQuestionBank: async (params: {
    module: 'interview' | 'research' | 'metacognition';
    query: string;
    top_k?: number;
    use_llm?: boolean;
  }): Promise<QuestionSearchResponse> => {
    const response = await axios.post(`${API_BASE_URL}/api/question-bank/llm-search`, params, {
      headers: adminHeaders(),
      timeout: 12000,
    });
    return response.data;
  },
};

// ── 一核三基地扩展接口：声明式场景档案 / Career MCP / 长周期随访 / 人工复核注记 ──

export interface SceneProfileTheoreticalFoundation {
  framework?: string;
  core_principle?: string;
  references?: string[];
  key_constructs?: string[];
}

export interface SceneProfileDescriptor {
  id: string;
  name: string;
  short_label: string;
  english_tag?: string;
  theme_key?: 'base1' | 'base2' | 'base3' | string;
  accent_color?: string;
  weight_label: string;
  route_base: string;
  baseline_mode: string;
  privacy_modes_supported: string[];
  default_privacy_mode: PrivacyConsentMode;
  question_bank_modules: string[];
  core_indicator_count: number;
  active_indicator_families: string[];
  extension_indicators: string[];
  stage_windows: string[];
  explicit_blocked_overrides: Array<{ key: string; label: string; reason: string }>;
  compliance_banner: string;
  description: string;
  theoretical_foundation?: SceneProfileTheoreticalFoundation;
  extensions?: {
    all_metacognition_indicators?: Array<{
      name: string;
      label: string;
      value: number | null;
      unit: string;
      confidence: string;
      gap?: string | null;
      summary?: string;
    }>;
    metacognition_regulation?: {
      covered_loops_labels?: string[];
      missing_loops_labels?: string[];
      indicators?: Array<{
        name: string;
        label: string;
        value: number | null;
        unit: string;
        confidence: string;
        gap?: string | null;
        summary?: string;
      }>;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
}

export const sceneProfilesApi = {
  list: async (): Promise<{
    status: string;
    default_profile: string;
    profiles: SceneProfileDescriptor[];
  }> => {
    const response = await axios.get(`${API_BASE_URL}/api/scene-profiles`, { timeout: 8000 });
    return response.data;
  },
  get: async (id: string): Promise<{ status: string; profile: SceneProfileDescriptor }> => {
    const response = await axios.get(
      `${API_BASE_URL}/api/scene-profiles?id=${encodeURIComponent(id)}`,
      { timeout: 8000 }
    );
    return response.data;
  },
};

export interface CareerCompetencyItem {
  key: string;
  label: string;
  required_indicators: string[];
  critique_focus?: string;
  matched_keywords?: string[];
  theoretical_construct?: string;
  theory_framework?: string;
}

export interface CareerPosition {
  position_id: string;
  title: string;
  track: string;
  level: string;
  jd_summary: string;
  observable_competencies: CareerCompetencyItem[];
  blocked_hard_skills: string[];
  sample_ai_critique_prompt?: string;
}

export interface JdDecomposeResponse {
  status: string;
  source: string;
  char_count: number;
  observable_competencies: CareerCompetencyItem[];
  blocked_hard_skills: string[];
  non_scoring_notice: string;
}

export interface CritiqueTaskResponse {
  status: string;
  position_title: string;
  task_pattern: string;
  stages: Array<{ stage: string; label: string; tip: string }>;
  question_prompt: string;
  focus_checklist: string[];
}

export interface EvidenceAlignmentResponse {
  status: string;
  session_id: string;
  position_id: string;
  position_title: string;
  scoring_participation: boolean;
  non_scoring_statement: string;
  theoretical_construct?: string;
  theory_framework?: string;
  summary_counts: {
    competencies_total: number;
    covered_strong: number;
    covered_partial: number;
    missing_gap: number;
  };
  referee_stage_summary: {
    stage_label: string;
    uncertainty_escalated: boolean;
  };
  competency_alignments: Array<{
    key: string;
    label: string;
    coverage_status: string;
    critique_focus: string;
    theoretical_construct?: string;
    theory_framework?: string;
    evidences: Array<{
      indicator: string;
      label: string;
      value: number | null;
      unit: string;
      confidence: string;
      gap: string | null;
    }>;
  }>;
  explicit_blocked_hard_skills: string[];
  next_practice_task: Omit<CritiqueTaskResponse, 'status'>;
}

export const careerMcpApi = {
  rpc: async (method: string, params?: Record<string, unknown>, id: number | string = 1) => {
    const response = await axios.post(
      `${API_BASE_URL}/api/mcp/career`,
      { jsonrpc: '2.0', id, method, params: params ?? {} },
      { timeout: 15000 }
    );
    return response.data;
  },
  listPositions: async (params?: { keyword?: string; track?: string; level?: string }): Promise<{
    status: string;
    total: number;
    tracks: string[];
    levels: string[];
    positions: CareerPosition[];
    scoring_participation: boolean;
  }> => {
    const q = new URLSearchParams();
    if (params?.keyword) q.set('keyword', params.keyword);
    if (params?.track) q.set('track', params.track);
    if (params?.level) q.set('level', params.level);
    const qs = q.toString();
    const response = await axios.get(`${API_BASE_URL}/api/career/positions${qs ? `?${qs}` : ''}`, {
      timeout: 10000,
    });
    return response.data;
  },
  decomposeJd: async (jd_text: string): Promise<JdDecomposeResponse> => {
    const response = await axios.post(
      `${API_BASE_URL}/api/career/decompose-jd`,
      { jd_text },
      { timeout: 10000 }
    );
    return response.data;
  },
  generateTask: async (params: { position_id?: string; jd_text?: string }): Promise<CritiqueTaskResponse> => {
    const response = await axios.post(`${API_BASE_URL}/api/career/generate-task`, params, {
      timeout: 10000,
    });
    return response.data;
  },
  alignEvidence: async (params: {
    session_id: string;
    position_id?: string;
    jd_text?: string;
  }): Promise<EvidenceAlignmentResponse> => {
    const response = await axios.post(`${API_BASE_URL}/api/career/align-evidence`, params, {
      timeout: 20000,
    });
    return response.data;
  },
};

export interface LongitudinalVisitSummary {
  session_id: string;
  tested_at: string | null;
  def_version: string;
  def_version_note: string;
  pose_mode: string;
  has_loaded_logs: boolean;
  coverage_passed: number;
  coverage_slots: number;
  confidence_cap: string;
  referee_stage_code: string;
  referee_stage_label: string;
  uncertainty_escalated: boolean;
  ood_anomaly_flag: boolean;
  visit_order: number;
  visit_label: string;
  privacy_mode: string;
}

export interface LongitudinalMetricSeries {
  key: string;
  label: string;
  unit: string;
  summary: {
    n_valid_visits: number;
    t0_baseline: number | null;
    p25: number | null;
    median: number | null;
    p75: number | null;
    mad?: number | null;
    iqr?: number | null;
    ewma_lambda?: number;
    ewma_latest?: number | null;
    n_drift_flagged?: number;
    drawable: boolean;
  };
  points: Array<{
    visit_order: number;
    visit_label: string;
    session_id: string;
    value: number | null;
    delta_from_t0_pct: number | null;
    ewma_value?: number | null;
    robust_drift_z?: number | null;
    drift_status?: string;
    confidence: string;
    gap: string | null;
  }>;
}

export interface LongitudinalSubject {
  subject_code: string;
  scene_profile: string;
  alias_note: string;
  consent_mode: PrivacyConsentMode | string;
  created_at: string;
  updated_at: string;
  visits: Array<{
    session_id: string;
    visit_order: number;
    visit_label: string;
    privacy_mode: string;
    attached_at: string;
  }>;
}

export interface LongitudinalTrajectoryResponse {
  status: string;
  subject?: LongitudinalSubject;
  comparable: boolean;
  def_versions: string[];
  comparability_notes: string[];
  n_visits: number;
  visits: LongitudinalVisitSummary[];
  series: LongitudinalMetricSeries[];
  review_alerts: string[];
  compliance_note: string;
  methodology?: {
    paradigm?: string;
    smoothing?: string;
    robust_band?: string;
    references?: string[];
  };
}

export const longitudinalApi = {
  listSubjects: async (): Promise<{
    status: string;
    compliance_note: string;
    metrics: Array<{ key: string; label: string; unit: string; source: string }>;
    subjects: LongitudinalSubject[];
  }> => {
    const response = await axios.get(`${API_BASE_URL}/api/longitudinal/subjects`, { timeout: 10000 });
    return response.data;
  },
  upsertSubject: async (params: {
    subject_code: string;
    scene_profile?: string;
    alias_note?: string;
    consent_mode?: PrivacyConsentMode;
  }) => {
    const response = await axios.post(`${API_BASE_URL}/api/longitudinal/subjects`, params, {
      timeout: 10000,
    });
    return response.data;
  },
  attachVisit: async (
    subjectCode: string,
    params: { session_id: string; visit_label?: string; privacy_mode?: PrivacyConsentMode }
  ) => {
    const response = await axios.post(
      `${API_BASE_URL}/api/longitudinal/subjects/${encodeURIComponent(subjectCode)}/visits`,
      params,
      { timeout: 10000 }
    );
    return response.data;
  },
  getTrajectory: async (subjectCode: string): Promise<LongitudinalTrajectoryResponse> => {
    const response = await axios.get(
      `${API_BASE_URL}/api/longitudinal/subjects/${encodeURIComponent(subjectCode)}/trajectory`,
      { timeout: 20000 }
    );
    return response.data;
  },
  compareSessions: async (
    sessionIds: string[],
    sceneProfile = 'research_interview'
  ): Promise<LongitudinalTrajectoryResponse> => {
    const q = new URLSearchParams({
      session_ids: sessionIds.join(','),
      scene_profile: sceneProfile,
    });
    const response = await axios.get(`${API_BASE_URL}/api/reports/compare?${q.toString()}`, {
      timeout: 25000,
    });
    return response.data;
  },
};

export interface ReviewerNote {
  session_id: string;
  exists: boolean;
  verification_status: 'pending_review' | 'verified_consistent' | 'needs_recollect' | 'signal_artifact_noted' | string;
  verification_label: string;
  focus_tags: string[];
  note_text: string;
  updated_at: string | null;
}

export const reviewerNotesApi = {
  get: async (sessionId: string): Promise<{ status: string; note: ReviewerNote }> => {
    const response = await axios.get(
      `${API_BASE_URL}/api/report/review-notes/${encodeURIComponent(sessionId)}`,
      { timeout: 8000 }
    );
    return response.data;
  },
  save: async (
    sessionId: string,
    params: {
      verification_status: string;
      focus_tags: string[];
      note_text: string;
    }
  ): Promise<{ status: string; note: ReviewerNote }> => {
    const response = await axios.post(
      `${API_BASE_URL}/api/report/review-notes/${encodeURIComponent(sessionId)}`,
      params,
      { headers: adminHeaders(), timeout: 8000 }
    );
    return response.data;
  },
};

export default api;

