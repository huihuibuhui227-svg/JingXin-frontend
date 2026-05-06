import React from 'react';
import { Card, Row, Col, Progress, Tag, Statistic } from 'antd';
import { SmileOutlined, EyeOutlined, InteractionOutlined, FireOutlined} from '@ant-design/icons';
import { RealtimeMetrics as MetricsType } from '@/types/assessment';
import { EMOTION_MAP } from '@/utils/constants';

interface RealtimeMetricsProps {
  metrics: MetricsType;
}

const RealtimeMetrics: React.FC<RealtimeMetricsProps> = ({ metrics }) => {
  const { face, gesture, voice } = metrics;

  return (
    <Card title="实时多模态分析" bordered={false} style={{ borderRadius: '8px' }}>
      <Row gutter={[16, 16]}>
        {/* ========== 面部表情分析 ========== */}
        {face && (
          <>
            <Col span={24}>
              <Tag color="blue" icon={<SmileOutlined />} style={{ fontSize: '14px', padding: '4px 12px' }}>
                😊 情绪状态: {EMOTION_MAP[face.emotion] || face.emotion}
              </Tag>
            </Col>

            <Col span={12}>
              <Statistic
                title="专注度"
                value={Math.round((face.focus_score || 0) * 100)}
                suffix="/ 100"
                valueStyle={{
                  color: (face.focus_score || 0) > 0.6 ? '#52c41a' : '#faad14',
                  fontSize: '18px'
                }}
              />
            </Col>

            <Col span={12}>
              <Statistic
                title="紧张度"
                value={Math.round((face.tension_score || 0) * 100)}
                suffix="/ 100"
                valueStyle={{
                  color: (face.tension_score || 0) > 0.6 ? '#ff4d4f' : '#52c41a',
                  fontSize: '18px'
                }}
              />
            </Col>

            <Col span={24}>
              <div style={{ marginBottom: 4, fontSize: '12px', color: '#666' }}>
                面部对称性
              </div>
              <Progress
                percent={Math.round((face.symmetry_score || 0) * 100)}
                strokeColor="#1890ff"
                size="small"
                format={(percent) => `${percent}%`}
              />
            </Col>

            <Col span={24}>
              <div style={{ marginBottom: 4, fontSize: '12px', color: '#666' }}>
                眼神稳定性
              </div>
              <Progress
                percent={Math.round((face.gaze_stability || 0) * 100)}
                strokeColor={(face.gaze_stability || 0) > 0.7 ? '#52c41a' : '#faad14'}
                size="small"
                format={(percent) => `${percent}%`}
              />
            </Col>
          </>
        )}

        {/* ========== 手势姿态分析 ========== */}
        {gesture && (
          <>
            <Col span={24}>
              <Tag color="green" icon={<InteractionOutlined />} style={{ fontSize: '14px', padding: '4px 12px' }}>
                🙌 检测到 {gesture.detected_hands} 只手
              </Tag>
            </Col>

            <Col span={12}>
              <Statistic
                title="手部姿态"
                value={gesture.hand_score || 0}
                suffix="/ 100"
                valueStyle={{
                  color: (gesture.hand_score || 0) > 60 ? '#52c41a' : '#faad14',
                  fontSize: '18px'
                }}
              />
            </Col>

            <Col span={12}>
              <Statistic
                title="肩部稳定"
                value={gesture.shoulder_score || 0}
                suffix="/ 100"
                valueStyle={{
                  color: (gesture.shoulder_score || 0) > 60 ? '#52c41a' : '#faad14',
                  fontSize: '18px'
                }}
              />
            </Col>

            {(gesture.left_arm_score !== undefined || gesture.right_arm_score !== undefined) && (
              <>
                <Col span={12}>
                  <div style={{ marginBottom: 4, fontSize: '12px', color: '#666' }}>
                    左臂姿态
                  </div>
                  <Progress
                    percent={gesture.left_arm_score || 0}
                    strokeColor="#722ed1"
                    size="small"
                    format={(percent) => `${percent}%`}
                  />
                </Col>

                <Col span={12}>
                  <div style={{ marginBottom: 4, fontSize: '12px', color: '#666' }}>
                    右臂姿态
                  </div>
                  <Progress
                    percent={gesture.right_arm_score || 0}
                    strokeColor="#722ed1"
                    size="small"
                    format={(percent) => `${percent}%`}
                  />
                </Col>
              </>
            )}

            {gesture.jitter !== undefined && (
              <Col span={24}>
                <div style={{ marginBottom: 4, fontSize: '12px', color: '#666' }}>
                  动作抖动指数
                </div>
                <Progress
                  percent={Math.max(0, 100 - Math.round((gesture.jitter || 0) * 100))}
                  strokeColor={(gesture.jitter || 0) < 0.3 ? '#52c41a' : '#faad14'}
                  size="small"
                  format={(percent) => `${percent}% 稳定`}
                />
              </Col>
            )}
          </>
        )}

        {/* ========== 语音分析（预留） ========== */}
        {voice && (
          <>
            <Col span={24}>
              <Tag color="purple" icon={<FireOutlined />} style={{ fontSize: '14px', padding: '4px 12px' }}>
                🎤 语音分析
              </Tag>
            </Col>

            <Col span={12}>
              <Statistic
                title="流畅度"
                value={voice.fluency || 0}
                suffix="/ 100"
                valueStyle={{ fontSize: '18px' }}
              />
            </Col>

            <Col span={12}>
              <Statistic
                title="语音能量"
                value={Math.round((voice.energy || 0) * 100)}
                suffix="/ 100"
                valueStyle={{ fontSize: '18px' }}
              />
            </Col>
          </>
        )}

        {/* ========== 空状态提示 ========== */}
        {!face && !gesture && !voice && (
          <Col span={24}>
            <div style={{ textAlign: 'center', color: '#999', padding: '40px 20px' }}>
              <EyeOutlined style={{ fontSize: '48px', marginBottom: '16px', display: 'block' }} />
              <div style={{ fontSize: '16px' }}>等待数据分析...</div>
              <div style={{ fontSize: '12px', marginTop: '8px', color: '#bbb' }}>
                系统正在采集面部、手势、语音等多维度数据
              </div>
            </div>
          </Col>
        )}
      </Row>
    </Card>
  );
};

export default RealtimeMetrics;

