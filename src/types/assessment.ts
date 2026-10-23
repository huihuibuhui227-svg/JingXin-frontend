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
 *
 * ⚠️ 2026-10-04 **再对齐一次(第 3 条同类问题)**:评分类的键后端**整层摘除**了 ——
 * `total_score` / `total_level` / 逐维度 `score` / `level` / `dimension_weights`
 * 一个都不再发。理由不是"它们算错了",而是**它们不该存在**:那是未标定标尺上对人的
 * 复合判定(见 `research_mapper` 返回处那段注释 + spec §5.4 :157-158 / §5.6)。
 * ⟹ 本文件里那两个字段也一并删掉 —— **类型层是"悄悄加回来"的最后一道闸**:
 * 只要 `EvaluationResult` 上还挂着 `score`,下一个人就会照着它渲染。
 * 后端由 `tests/test_report_layer.py::test_the_payload_carries_no_scoring_keys_at_all` 守。
 */
export interface EvaluationResult {
  /**
   * ⚠️ 2026-10-18 **五维变可选**。`/api/report/structured` 默认引擎已切到 L1
   * (`?engine=l1`),而 L1 的构念对账发现:`行为表现活跃度` 的三个槽
   * (手掌张开度 / 肩部放松度 / 眼神接触)**没有同构念的 L1 指标** ——
   * 不是"这一场没测到",是那个维度量的东西当前管线都不测。
   *
   * ⟹ 它会**整个不出现在** `dimensions` 里,而进 `vanished_dimensions` 并带理由。
   * `ReportViewer` 对缺失维度是 `if (!dim) return null`,所以少键是安全的;
   * 但**类型层必须允许它少** —— 否则下一个人会以为五个键一定都在,
   * 然后在 `report.dimensions.confidence_level.confidence` 上取到一个 undefined 崩掉。
   *
   * 旧引擎(`?engine=legacy`)仍然给满五个。
   */
  dimensions: Partial<Record<DimensionKey, DimensionResult>>;
  /** 本次用的是哪个引擎。`l1` = M4.5 起的默认;`legacy` = 旧的 14 槽模糊匹配。 */
  engine?: 'l1' | 'legacy';
  /**
   * **消失的维度** —— 全部槽都没有同构念 L1 指标、因此整维不进 `dimensions`。
   *
   * 必须渲染:读者要能看出"这一维为什么不见了"。不渲染的话,报告会悄悄少一块,
   * 而少的那块恰好是"当前管线测不到的东西" —— 那是最该说出来的部分。
   */
  vanished_dimensions?: VanishedDimension[];
  /** L1 的完整审计链(逐条指标状态 + 模态覆盖率 + gap 计数)。复核用,不必渲染。 */
  l1?: L1Audit;
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

export type DimensionKey =
  | 'logical_thinking'
  | 'stress_resilience'
  | 'communication_fluency'
  | 'confidence_level'
  | 'cognitive_efficiency';

/** 一个**整维消失**的原因(L1 引擎)。 */
export interface VanishedDimension {
  key: DimensionKey;
  display_name: string;
  /** 该维原有的槽数(仍计入 `coverage.n_slots`)。 */
  n_slots: number;
  dropped: { slot: string; reason: string }[];
  reason: string;
}

/** L1 的审计链 —— 一条一条能对得上规格,报告层不渲染。 */
/** 一条 L1 指标的**实测记录**(后端 `L1Indicator.to_dict()` 的逐字段镜像)。
 *  `gap` 非空 ⟺ `value` 为 `null` —— 二者必须一致,后端有硬校验。 */
export interface L1IndicatorRow {
  name: string;
  /** 族:`F1_smile` / `G2_posture` / `V…` / `T1_lexical` 这类,首字母即模态。 */
  family: string;
  /** 公式串。**含阈值来源与口径限制**(例如"全场混音,含面试官")。 */
  formula: string;
  /** 这条指标依赖的 L0 列 / 数据源。 */
  required_l0: string[];
  window: string;
  value: number | null;
  unit: string;
  n_valid: number;
  n_total: number;
  confidence: string;
  gap: string | null;
}

export interface L1Audit {
  n_total: number;
  n_measured: number;
  by_confidence: Record<string, number>;
  by_gap: Record<string, number>;
  modality_coverage: Record<string, {
    rows: number;
    usable_rows: number;
    usable_ratio: number;
    provided: boolean;
  }>;
  indicators: L1IndicatorRow[];
  /** 「置信低**为什么**低」的逐条说明(后端 `explain_confidence()`)。
   *  置信度只说"有多信",不回答"为什么只有这么信" —— 后者才是读者要的那句话。
   *  ⚠️ 后端曾把这张表写好却**没有调用点**,所以字段可能缺失:前端按可选处理。 */
  low_confidence_notes?: string[];
  /** ★ 与旧引擎报告对比时的提醒:这些槽**保留了下来但统计量换了**,
   *  两边的数相减没有含义。来自 `l1_mapper.comparability_notes()`。 */
  comparability_notes?: string[];
  gaps: string[];
  /** ★ 窗口口径 —— 这场是"整场一个窗口"还是"每回答一个窗口"。
   *  `granularity="session"` ⟹ 本场没有提问台账,F/G 按整场算,不能与逐题场比。
   *  `frames_outside` = 落在所有窗口之外的帧数(模态 → 计数):有台账时首个 `ask_end`
   *  之前的帧不属于任何窗口,这是唯一能看出"分母被排除了多少"的数。 */
  windows?: {
    granularity?: string;
    n_windows?: number;
    n_questions?: number;
    n_answer_segments?: number;
    wall_reliable?: boolean;
    frames_outside?: Record<string, number>;
  };
  /** ★ 逐题值的**题间离散度**(裁定① 的离散度层)。
   *  逐题值不冒充会话级值 —— 它只回答"这一场的表现在题与题之间稳不稳"。
   *  ⚠️ **只在本场内有意义**:不同场次的题目不同,离散度不可跨场相减。
   *  少于 2 题的指标不出现(单题没有"题间"可言)。 */
  dispersion?: Record<string, {
    n_questions: number;
    median: number;
    iqr: number;
    min: number;
    max: number;
  }>;
  dispersion_note?: string;
  /** 各模态时间基。`span_sec` = 该模态**覆盖到的时间范围**(秒,含重启空档)。
   *  ⚠️ 与 `n_frames` 不是一回事:1 Hz 的 6968 帧可跨 7427 秒,而 31.25 Hz 的
   *  13585 帧只跨 434.7 秒 —— 判断"两族看的是不是同一段时间"只能比 `span_sec`。 */
  timebase?: Record<string, {
    provided?: boolean;
    usable?: boolean;
    status?: string;
    n_frames?: number;
    span_sec?: number | null;
    drift_sec?: number | null;
    wall_back_steps?: number;
  }>;
}

/** `coverage` —— 本次观测的覆盖事实。字段逐一对齐 `research_mapper._coverage()`。 */
export interface Coverage {
  /** 分母是**声明的全部旧槽数**(14),包含已消失维度的那几个槽。 */
  n_slots: number;
  n_passed: number;
  /** 没有同构念 L1 指标、已删掉的槽数(仍计入 `n_slots`)。仅 L1 引擎给。 */
  n_dropped?: number;
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
  /** 该维度这次过了门的槽(原始值 + 本场观测区间 + 有效样本量 + 置信度)。
   *  ⚠️ 这里曾有两个字段 `score: number | null` 与 `level: string` —— 2026-10-04 删除。
   *  "该维度能说什么"改由 `matched_indicators`(过门 N/M)+ `confidence` + 本数组表达。 */
  evidence_chain: EvidenceItem[];
  /** 该维度**为什么薄** —— 逐槽一行(未采集到对应数据 / 本次会话内无变化 /
   *  该指标本轮停用 / 尚无产出方…)。这是使用者能据以行动的东西,报告要原样列出。 */
  evidence_gaps: string[];
  confidence: string;
  /** 形如 `"1/4"` —— 过门槽数 / 总槽数。 */
  matched_indicators: string;
  /** `{<槽关键词>: {val}}`。**注意没有 `percentile`** —— 见文件顶部说明。 */
  stats: Record<string, { val: number }>;
}

/**
 * 一个**过了证据门**的槽在证据链里的那一行。
 *
 * ⚠️ 2026-10-04 **字段集收窄**:删掉 `normalized_score` / `contribution` / `status`
 * (`✅ 强支撑`/`⚠️ 弱支撑`/`➖ 中性`)/ `direction` / `weight`,以及维度上的
 * `positive_factors` / `negative_factors` —— 它们都是**未标定标尺上的折算值与判定标签**
 * (与档位同一类物种),随评分层一起摘除(见文件顶部说明)。
 * 现在这一行只说**测到了什么**:原始值 + 本场观测区间 + 有效样本量。
 * 后端由 `tests/test_report_layer.py` 里那条"字段集"断言守着。
 */
export interface EvidenceItem {
  feature: string;
  human_name: string;
  raw_value: number;
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


