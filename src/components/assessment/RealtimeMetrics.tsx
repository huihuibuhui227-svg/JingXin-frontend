import React from 'react';
import { Card, Row, Col, Progress, Tag, Statistic } from 'antd';
import { SmileOutlined, EyeOutlined, InteractionOutlined, FireOutlined} from '@ant-design/icons';
import { RealtimeMetrics as MetricsType } from '@/types/assessment';
import { EMOTION_MAP } from '@/utils/constants';
import { stoppedReason } from '@/utils/stoppedMetrics';

interface RealtimeMetricsProps {
  metrics: MetricsType;
}

/** 「报告层已停用」的小标记。
 *
 *  这些量**数据是真的**,但在报告层已被封停(近常量 / 取景代理 / 伪合成 / 可被别的量
 *  精确重构)。面板此前把它们当正常指标显示,与报告自相矛盾 —— 同一场会话,报告说
 *  「该指标本轮停用」,面板却画着「面部对称性 99%」。封停理由原样来自后端名单。
 */
const StoppedTag: React.FC<{ metricKey: string }> = ({ metricKey }) => {
  const reason = stoppedReason(metricKey);
  if (!reason) return null;
  return (
    <span title={`报告层已停用本指标:${reason}`}
          style={{
            marginLeft: 6, fontSize: '10px', color: 'var(--ax-text-secondary)',
            border: '1px solid var(--ax-hairline)', borderRadius: '3px', padding: '0 3px',
            verticalAlign: 'middle', cursor: 'help'
          }}>
      停用
    </span>
  );
};

/** “没测到”也是一种结论,必须说出来。
 *
 *  此前这块面板把没测到的量渲染成 **0** 或 **100%**:`jitter` 在没检测到手时被填 0,
 *  而这一行按 `100 - jitter*100` 画 ⟹ **"没测到"被画成了"100% 稳定"** —— 一个看着
 *  最好、其实什么都没量的数(2026-09-26 使用者当场发现:"动作抖动指数根本就没有变")。
 *  服务端在没检测到姿态时还会把分**填成 50.0**,于是"什么都没测到"看起来像"测到了 50 分"。
 */
const Absent: React.FC<{ title: string; text: string; hint?: string }> = ({ title, text, hint }) => (
  <div title={hint}>
    <div style={{ marginBottom: 4, fontSize: '12px', color: 'var(--ax-text-secondary)' }}>{title}</div>
    <div style={{ fontSize: '18px', color: 'var(--ax-text-secondary)' }}>{text}</div>
  </div>
);

const RealtimeMetrics: React.FC<RealtimeMetricsProps> = ({ metrics }) => {
  const { face, gesture, voice } = metrics;

  return (
    <Card title="实时多模态分析" variant="borderless" style={{ borderRadius: '8px' }}>
      <Row gutter={[16, 16]}>
        {/* ========== 面部表情分析 ========== */}
        {face && (
          <>
            <Col span={24}>
              <Tag color="blue" icon={<SmileOutlined />} style={{ fontSize: '14px', padding: '4px 12px' }}>
                情绪状态：{EMOTION_MAP[face.emotion] || face.emotion}
              </Tag>
            </Col>

            <Col span={12}>
              <Statistic
                title={<span>专注度<StoppedTag metricKey="focus_score" /></span>}
                value={Math.round((face.focus_score || 0) * 100)}
                suffix="/ 100"
                valueStyle={{
                  color: (face.focus_score || 0) > 0.6 ? 'var(--ax-success)' : 'var(--ax-warning)',
                  fontSize: '18px'
                }}
              />
            </Col>

            <Col span={12}>
              <Statistic
                title={<span>紧张度<StoppedTag metricKey="tension_score" /></span>}
                value={Math.round((face.tension_score || 0) * 100)}
                suffix="/ 100"
                valueStyle={{
                  color: (face.tension_score || 0) > 0.6 ? 'var(--ax-error)' : 'var(--ax-success)',
                  fontSize: '18px'
                }}
              />
            </Col>

            <Col span={24}>
              <div style={{ marginBottom: 4, fontSize: '12px', color: 'var(--ax-text-secondary)' }}>
                面部对称性<StoppedTag metricKey="symmetry_score" />
              </div>
              <Progress
                percent={Math.round((face.symmetry_score || 0) * 100)}
                strokeColor="var(--ax-primary)"
                size="small"
                format={(percent) => `${percent}%`}
              />
            </Col>

            <Col span={24}>
              <div style={{ marginBottom: 4, fontSize: '12px', color: 'var(--ax-text-secondary)' }}>
                眼神稳定性<StoppedTag metricKey="gaze_stability" />
              </div>
              <Progress
                percent={Math.round((face.gaze_stability || 0) * 100)}
                strokeColor={(face.gaze_stability || 0) > 0.7 ? 'var(--ax-success)' : 'var(--ax-warning)'}
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
                检测到 {gesture.detected_hands} 只手
              </Tag>
            </Col>

            <Col span={12}>
              {gesture.hand_valid ? (
                <Statistic
                  title={<span>手部姿态<StoppedTag metricKey="hand_score" /></span>}
                  value={gesture.hand_score}
                  suffix="/ 100"
                  valueStyle={{
                    color: gesture.hand_score > 60 ? 'var(--ax-success)' : 'var(--ax-warning)',
                    fontSize: '18px'
                  }}
                />
              ) : (
                <Absent title="手部姿态" text="未检出"
                        hint="这一帧没有检测到手 —— 服务端此时会把分填成 50.0，所以「没测到」与「测得 50 分」只能靠是否检出来分" />
              )}
            </Col>

            <Col span={12}>
              {gesture.shoulder_valid ? (
                <Statistic
                  title="肩部稳定"
                  value={gesture.shoulder_score}
                  suffix="/ 100"
                  valueStyle={{
                    color: gesture.shoulder_score > 60 ? 'var(--ax-success)' : 'var(--ax-warning)',
                    fontSize: '18px'
                  }}
                />
              ) : (
                <Absent title="肩部稳定" text="未检出" hint="本帧没有检测到姿态关键点" />
              )}
            </Col>

            <>
              <Col span={12}>
                {gesture.left_arm_valid ? (
                  <>
                    <div style={{ marginBottom: 4, fontSize: '12px', color: 'var(--ax-text-secondary)' }}>
                      左臂姿态
                    </div>
                    <Progress
                      percent={gesture.left_arm_score}
                      strokeColor="var(--ax-primary)"
                      size="small"
                      format={(percent) => `${percent}%`}
                    />
                  </>
                ) : (
                  <Absent title="左臂姿态" text="未检出" hint="左臂分析器本帧没有有效结果" />
                )}
              </Col>

              <Col span={12}>
                {gesture.right_arm_valid ? (
                  <>
                    <div style={{ marginBottom: 4, fontSize: '12px', color: 'var(--ax-text-secondary)' }}>
                      右臂姿态
                    </div>
                    <Progress
                      percent={gesture.right_arm_score}
                      strokeColor="var(--ax-primary)"
                      size="small"
                      format={(percent) => `${percent}%`}
                    />
                  </>
                ) : (
                  <Absent title="右臂姿态" text="未检出" hint="右臂分析器本帧没有有效结果" />
                )}
              </Col>
            </>

            <Col span={24}>
              {/* ⚠️ 判据是 **`hand_valid`(这一帧有没有手)**,不是 `jitter !== undefined`。
                  服务端在没检测到手时**仍然回一个数**(`jitter: 0.0` —— 分析器的默认值),
                  所以"没有值就不显示"这条根本不会触发:面板照旧把 0 画成「100% 稳定」。
                  实测(2026-09-26 场 20260926_135015_d47d,使用者当场抓到):
                  `detected_hands: 0 / is_valid: false` 而 `jitter: 0.0`。 */}
              {gesture.hand_valid && gesture.jitter !== undefined ? (
                <>
                  <div style={{ marginBottom: 4, fontSize: '12px', color: 'var(--ax-text-secondary)' }}>
                    动作抖动指数
                  </div>
                  <Progress
                    percent={Math.max(0, 100 - Math.round(gesture.jitter * 100))}
                    strokeColor={gesture.jitter < 0.3 ? 'var(--ax-success)' : 'var(--ax-warning)'}
                    size="small"
                    format={(percent) => `${percent}% 稳定`}
                  />
                </>
              ) : (
                <Absent title="动作抖动指数" text="未检出"
                        hint="没检测到手就没有抖动可言。此前这里填 0，于是画成「100% 稳定」——把「没测到」说成了「最稳」" />
              )}
            </Col>
          </>
        )}

        {/* ========== 语音分析 ========== */}
        {voice && (
          <>
            <Col span={24}>
              <Tag color="purple" icon={<FireOutlined />} style={{ fontSize: '14px', padding: '4px 12px' }}>
                语音分析 {voice.voiceActive && '(录音中)'}
              </Tag>
            </Col>

            <Col span={12}>
              <Absent title="流畅度" text="待接入"
                      hint="全系统没有产出方(报告层同样只写「尚无产出方」)。此前这里显示 0/100，那是个恒 0 的常数，不是测量值" />
            </Col>

            <Col span={12}>
              <Absent title="语音能量" text="待接入"
                      hint="此前显示的数是**音频字节数代理**（本场录音大小 ÷ 定值），不是声学能量：同一场里几乎不动，跨场也不可比（报告层已按 energy_mean 封停）" />
            </Col>
          </>
        )}

        {/* ========== 空状态提示 ========== */}
        {!face && !gesture && !voice && (
          <Col span={24}>
            <div style={{ textAlign: 'center', color: 'var(--ax-text-secondary)', padding: '40px 20px' }}>
              <EyeOutlined style={{ fontSize: '48px', marginBottom: '16px', display: 'block' }} />
              <div style={{ fontSize: '16px' }}>等待数据分析...</div>
              <div style={{ fontSize: '12px', marginTop: '8px', color: 'var(--ax-text-secondary)' }}>
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

