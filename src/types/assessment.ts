export interface EvaluationResult {
  total_score: number;
  total_level: string;
  dimensions: {
    logical_thinking: DimensionResult;
    stress_resilience: DimensionResult;
    communication_fluency: DimensionResult;
    confidence_level: DimensionResult;
    cognitive_efficiency: DimensionResult;
  };
  summary_narrative: string;
  model_metadata: {
    version: string;
    timestamp: string;
  };
}

export interface DimensionResult {
  display_name: string;
  description: string;
  algorithm: string;
  score: number;
  level: string;
  narrative: string;
  simple_narrative: string;
  evidence_chain: EvidenceItem[];
  positive_factors: string[];
  negative_factors: string[];
  confidence: string;
  matched_indicators: string;
  stats: Record<string, {
    val: number;
    percentile: number;
  }>;
}

export interface EvidenceItem {
  feature: string;
  human_name: string;
  raw_value: number;
  normalized_score: number;
  contribution: number;
  status: string;
  direction: string;
  weight: number;
  percentile: number;
}

export interface RealtimeMetrics {
  face?: {
    emotion: string;
    au_features: {
      au_1?: number;
      au_4?: number;
      au_6?: number;
      au_12?: number;
    };
    focus_score: number;
    tension_score: number;
    symmetry_score: number;
    gaze_stability: number;
    eye_contact_ratio: number;
  };
  gesture?: {
    detected_hands: number;
    hand_score: number;
    shoulder_score: number;
    left_arm_score: number;
    right_arm_score: number;
    /** 手部抖动。**没有检测到手时不给值(undefined)** —— 此前这里填 0,
     *  而面板按 `100 - jitter*100` 渲染,于是"没测到"被画成了"100% 稳定":
     *  一个看着最好、其实什么都没量的数(2026-09-26 使用者当场发现)。 */
    jitter?: number;
    /** 各分析器**这次是否真的出了值**。
     *
     *  ⚠️ 必须单独传:服务端在没检测到姿态时会把分**填成 50.0**
     *  (`gesture_analysis/api/app.py`,shoulder/arm/hand 三处),所以光看数量
     *  分不出"测到 50 分"与"没测到" —— 只有这个标志分得出。面板据此显示
     *  「未检出」,而不是一个看着正常的中性值。 */
    hand_valid?: boolean;
    shoulder_valid?: boolean;
    left_arm_valid?: boolean;
    right_arm_valid?: boolean;
  };
  voice?: {
    // ⚠️ 前四个是**可选**:实时路径眼下只有 energy 是由音频字节数真算出来的
    // (voiceActive 是"音频到了"这个事实)。fluency / pitch_variation /
    // pause_duration / speech_ratio 需要真的声学分析,在那接上来之前**宁可不报**,
    // 也不写死一个常数把面板填满 —— 那正是本项目在杀的那种"看起来像指标"的假数据。
    // 消费者请按 `?? 0` 处理(RealtimeMetrics.tsx 已经是这么写的)。
    fluency?: number;
    pitch_variation?: number;
    pause_duration?: number;
    speech_ratio?: number;
    /** ⚠️ 这是**音频字节数代理**(本场录音大小 ÷ 定值),不是声学意义上的语音能量 ——
     *  同一场里几乎不动,跨场也不可比(报告层已按 `energy_mean` 封停,理由是
     *  "设备增益/距离代理,跨会话不可比")。面板因此**不再把它画成"语音能量 ×/100"**,
     *  与 fluency 一样显示「待接入」,等真的声学特征接上来。 */
    energy?: number;
    voiceActive: boolean;
  };
}

export interface AnswerRecord {
  question: string;
  answer: string;
  timestamp: Date;
  audioFile?: File;
}


