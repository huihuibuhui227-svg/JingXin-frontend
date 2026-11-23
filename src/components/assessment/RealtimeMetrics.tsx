import React from 'react';
import { Card, Row, Col, Tag, Typography } from 'antd';
import { EyeOutlined, InteractionOutlined, AudioOutlined, VideoCameraOutlined } from '@ant-design/icons';
import { RealtimeMetrics as MetricsType } from '@/types/assessment';

const { Text } = Typography;

interface RealtimeMetricsProps {
  metrics: MetricsType;
}

const MetricTile: React.FC<{ label: string; value: string; note?: string; ok?: boolean }> = ({
  label,
  value,
  note,
  ok = true,
}) => (
  <div
    style={{
      padding: '10px 12px',
      borderRadius: 'var(--ax-rounded-sm)',
      background: 'var(--ax-parchment)',
      border: '1px solid var(--ax-divider-soft)',
    }}
  >
    <div style={{ fontSize: 12, color: 'var(--ax-text-secondary)' }}>{label}</div>
    <div
      style={{
        marginTop: 4,
        fontSize: 18,
        fontWeight: 600,
        fontVariantNumeric: 'tabular-nums',
        color: ok ? 'var(--ax-ink)' : 'var(--ax-text-secondary)',
      }}
    >
      {value}
    </div>
    {note && <div style={{ marginTop: 2, fontSize: 11, color: 'var(--ax-text-secondary)' }}>{note}</div>}
  </div>
);

/**
 * 采集期客观物理观测卡（仅显示仪器实时检出与物理量，绝不输出情绪、临床或能力打分）。
 */
const RealtimeMetrics: React.FC<RealtimeMetricsProps> = ({ metrics }) => {
  const { face, gesture, voice } = metrics;

  return (
    <Card
      title="三模态实时采集观测（仅物理读数，非评分）"
      size="small"
      style={{ borderRadius: 'var(--ax-rounded-md)' }}
    >
      <Row gutter={[12, 12]}>
        {face && (
          <>
            <Col span={24}>
              <Tag
                icon={<VideoCameraOutlined />}
                style={{
                  color: 'var(--ax-success)',
                  background: 'var(--ax-success-soft)',
                  borderColor: 'var(--ax-success-border)',
                }}
              >
                面部仪器在线 · 478 点网格已检出
              </Tag>
            </Col>
            <Col span={12}>
              <MetricTile
                label="面部画面占比"
                value={face.face_scale != null ? `${Math.round(face.face_scale * 100)}%` : '已检出'}
                note="建议 ≥ 20%"
              />
            </Col>
            <Col span={12}>
              <MetricTile
                label="AU12 微笑幅度"
                value={(face.au_features?.au_12 ?? 0).toFixed(2)}
                note="几何代理瞬时值"
              />
            </Col>
            <Col span={12}>
              <MetricTile
                label="AU4 眉间收缩"
                value={(face.au_features?.au_4 ?? 0).toFixed(2)}
                note="几何代理瞬时值"
              />
            </Col>
            <Col span={12}>
              <MetricTile
                label="平均眼开度 EAR"
                value={face.avg_ear != null ? face.avg_ear.toFixed(3) : '—'}
                ok={face.avg_ear != null}
                note="瞬时眨眼几何量"
              />
            </Col>
          </>
        )}

        {gesture && (
          <>
            <Col span={24}>
              <Tag
                icon={<InteractionOutlined />}
                style={{
                  color: gesture.hand_valid ? 'var(--ax-info)' : 'var(--ax-text-secondary)',
                  background: gesture.hand_valid ? 'var(--ax-info-soft)' : 'var(--ax-parchment)',
                  borderColor: gesture.hand_valid ? 'var(--ax-info-border)' : 'var(--ax-hairline)',
                }}
              >
                上肢仪器在线 · 当前检出 {gesture.detected_hands} 只手
              </Tag>
            </Col>
            <Col span={12}>
              <MetricTile
                label="上肢姿态检出"
                value={gesture.shoulder_valid ? '已检出' : '未检出'}
                ok={gesture.shoulder_valid === true}
              />
            </Col>
            <Col span={12}>
              <MetricTile
                label="手部瞬时抖动"
                value={
                  gesture.hand_valid && gesture.jitter !== undefined
                    ? gesture.jitter.toFixed(3)
                    : '未检出'
                }
                ok={gesture.hand_valid === true && gesture.jitter !== undefined}
                note="仅检出手部时有效"
              />
            </Col>
          </>
        )}

        {voice && (
          <Col span={24}>
            <Tag
              icon={<AudioOutlined />}
              style={{
                color: voice.voiceActive ? 'var(--ax-success)' : 'var(--ax-text-secondary)',
                background: voice.voiceActive ? 'var(--ax-success-soft)' : 'var(--ax-parchment)',
                borderColor: voice.voiceActive ? 'var(--ax-success-border)' : 'var(--ax-hairline)',
              }}
            >
              语音通道：{voice.voiceActive ? '已接收回答音频（完整韵律将于提交后提取）' : '待机'}
            </Tag>
          </Col>
        )}

        {!face && !gesture && !voice && (
          <Col span={24}>
            <div style={{ textAlign: 'center', color: 'var(--ax-text-secondary)', padding: '24px 12px' }}>
              <EyeOutlined style={{ fontSize: 32, marginBottom: 8, display: 'block' }} />
              <Text style={{ fontSize: 14, color: 'var(--ax-text-secondary)' }}>
                等待首帧采样返回，采集期间仅展示客观物理传感状态
              </Text>
            </div>
          </Col>
        )}
      </Row>
    </Card>
  );
};

export default RealtimeMetrics;
