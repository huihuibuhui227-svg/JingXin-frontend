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
    jitter: number;
  };
  voice?: {
    fluency: number;
    pitch_variation: number;
    energy: number;
    pause_duration: number;
    speech_ratio: number;
  };
}

// ... existing code ...

export interface AnswerRecord {
  question: string;
  answer: string;
  timestamp: Date;
  audioFile?: File;
}


