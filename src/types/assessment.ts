/**
 * `/api/report/structured` 的返回体。
 *
 * ⚠️ 2026-10-03 对齐真实载荷。此前这份手写类型里有**后端根本不发的字段**,
 * 前端照着它渲染,于是报告页与实时页各有一处"照着不存在的字段画"或"画了禁止画的东西":
 *   · `DimensionResult.narrative` / `.simple_narrative` —— 后端**已随 spec §5.4 删除**
 *     (`report_generator.py` 有明确注释:"该字段的产出方已随 spec §5.4 一并删除"),
 *     而报告页还在渲染它 ⟹ 那三张卡片一直是**空的**;
 *   · `DimensionResult.stats[].percentile` 与 `EvidenceItem.percentile` —— 真实载荷里
 *     `stats` 只有 `{val}`;**而"人群百分位"正是 spec §5.5 禁止给的东西**
 *     (没有真实常模就没有位置)。留着它等于给下一个人一个已备好的错误出口。
 * 判据:类型要对得上**后端实际发的键**(见 `research_mapper.map_features_to_scores`)。
 */
export interface EvaluationResult {
  /** ⚠️ 可为 `null` —— 一个维度过门都没有时后端就是给 null(spec §6.1)。
   *  且它是**未标定标尺上的复合点分**,报告层一个字都不渲染。 */
  total_score: number | null;
  total_level: string;
  dimensions: {
    logical_thinking: DimensionResult;
    stress_resilience: DimensionResult;
    communication_fluency: DimensionResult;
    confidence_level: DimensionResult;
    cognitive_efficiency: DimensionResult;
  };
  /** 「未产出综合评分,也不给评级」那类固定话术(spec §5.4)。 */
  summary_narrative: string;
  /** ★ 聚合呈现的**权威来源**(spec §5.4/§5.6):覆盖事实 + 逐指标实测区间 + 置信度上限。
   *  报告页此前只用了 `n_passed`/`n_slots`/`confidence_cap`,而 `passed_slots` 里
   *  那批**合规的逐指标依据取了从没渲染**。 */
  coverage?: Coverage;
  model_metadata: {
    version: string;
    timestamp: string;
  };
}

/** `coverage` —— 本次观测的覆盖事实。字段逐一对齐 `research_mapper._coverage()`。 */
export interface Coverage {
  n_slots: number;
  n_passed: number;
  /** 各维度置信度的**上限**(最乐观的那一个)。 */
  confidence_cap: string;
  passed_slots: CoverageSlot[];
}

/** 一个**过了证据门**的指标槽的实测依据 —— 与后端 HTML 报告渲染的是同一批字段。 */
export interface CoverageSlot {
  dimension: string;
  display_name: string;
  indicator: string;
  feature: string;
  raw_value: number;
  /** 本场会话内的观测区间(`[下界, 上界]`),**与 `raw_value` 同量纲**;取不到时是空数组。 */
  observed_interval: number[];
  n_valid: number;
  confidence: string;
}

export interface DimensionResult {
  display_name: string;
  description: string;
  algorithm: string;
  /** ⚠️ 可为 `null`(该维度没有槽过门)。**未标定标尺上的点分,报告层不渲染。** */
  score: number | null;
  /** 同上:五档评语,报告层不渲染。 */
  level: string;
  evidence_chain: EvidenceItem[];
  positive_factors: string[];
  negative_factors: string[];
  /** 该维度**为什么薄** —— 逐槽一行(未采集到对应数据 / 本次会话内无变化 /
   *  该指标本轮停用 / 尚无产出方…)。这是使用者能据以行动的东西,报告要原样列出。 */
  evidence_gaps: string[];
  confidence: string;
  /** 形如 `"1/4"` —— 过门槽数 / 总槽数。 */
  matched_indicators: string;
  /** `{<槽关键词>: {val}}`。**注意没有 `percentile`** —— 见文件顶部说明。 */
  stats: Record<string, { val: number }>;
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
  n_valid: number;
  std: number | null;
  /** 与 `raw_value` 同量纲的实测区间;无变异时后端给空数组。 */
  observed_interval: number[];
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


