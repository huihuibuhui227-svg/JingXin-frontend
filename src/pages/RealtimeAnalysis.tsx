import React, { useState, useEffect, useRef } from 'react';
import { Layout, Row, Col, Card, message } from 'antd';
import { useCamera } from '@/hooks/useCamera';
import { faceApi, gestureApi } from '@/services/api';
import { useAssessmentStore } from '@/store/assessmentStore';
import RadarChart from '@/components/visualization/RadarChart';
import TimelineChart from '@/components/visualization/TimelineChart';
import CameraView from '@/components/assessment/CameraView';

const { Content } = Layout;

const RADAR_LABELS = {
  logical_thinking: '面部专注度',
  stress_resilience: '紧张度',
  communication_fluency: '手势分',
  confidence_level: '面部对称性',
  cognitive_efficiency: '眼神稳定性',
} as const;

const RealtimeAnalysis: React.FC = () => {
  const frameCountRef = useRef(0);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [timelineData, setTimelineData] = useState<Array<{ timestamp: string; value: number; metric: string }>>([]);

  const { realtimeMetrics, updateRealtimeMetrics } = useAssessmentStore();
  const { videoRef, canvasRef, startCamera, stopCamera, startCapture, stopCapture } = useCamera({
    onFrame: async (frame) => {
      // 每10帧发送一次分析请求（降低频率，避免过多请求）
      frameCountRef.current += 1;
      if (frameCountRef.current % 10 !== 0) return;

      try {
        console.log('📤 [实时监控] 发送第', frameCountRef.current, '帧...');

        Promise.allSettled([
          // 面部分析
          faceApi.analyzeImage(frame).then(result => {
            if (result.status === 'success' && result.result) {
              const focusScore = result.result.focus_score || 0;

              updateRealtimeMetrics({
                face: {
                  emotion: result.result.emotion?.primary_emotion || 'neutral',
                  au_features: {
                    au_1: result.result.au_features?.au1_inner_brow_raise,
                    au_4: result.result.au_features?.au4_frown,
                    au_6: result.result.au_features?.au6_cheek_raise,
                    au_12: result.result.au_features?.au12_smile,
                  },
                  focus_score: focusScore,
                  tension_score: result.result.tension?.tension_score || 0,
                  symmetry_score: result.result.au_features?.symmetry_score || 0,
                  gaze_stability: 1 - (result.result.au_features?.gaze_deviation || 0),
                  eye_contact_ratio: 1 - (result.result.au_features?.gaze_deviation || 0),
                }
              });

              // 更新时间线数据
              const now = new Date();
              const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

              setTimelineData(prev => {
                const newData = [...prev, { timestamp: timeStr, value: focusScore, metric: '专注度' }];
                // 只保留最近20个数据点
                return newData.slice(-20);
              });
            }
          }).catch(err => {
            console.warn('⚠️ 面部分析失败:', err.message);
          }),

          // 手势分析
          gestureApi.analyzeGesture(frame).then(result => {
            if (result.status === 'success' && result.result) {
              // 与 AssessmentPage 同一口径:一并把"这次到底有没有测到"传上去。
              // 服务端没检测到姿态时会把分**填成 50.0**,光看数量分不出真假。
              const hands = result.result.detected_hands || 0;
              const hand = result.result.hand;
              updateRealtimeMetrics({
                gesture: {
                  detected_hands: hands,
                  hand_score: hand?.average_score || 0,
                  shoulder_score: result.result.shoulder?.shoulder_score || 0,
                  left_arm_score: result.result.arm?.left?.arm_score || 0,
                  right_arm_score: result.result.arm?.right?.arm_score || 0,
                  // 没测到就**不给值**:填 0 会被下面渲染成"0.0%"(看着像测到了一个很小的抖动)
                  jitter: hand?.left?.jitter !== undefined
                    ? (hand.left.jitter + (hand.right?.jitter || 0)) / 2
                    : undefined,
                  hand_valid: hands > 0,
                  shoulder_valid: result.result.shoulder?.is_valid === true,
                }
              });
            }
          }).catch(err => {
            console.warn('⚠️ 手势分析失败:', err.message);
          })
        ]);
      } catch (error) {
        console.error('❌ 帧处理错误:', error);
      }
    },
    frameRate: 5
  });

  // 五维雷达:五个量**都测到了**才画。
  //
  // ⚠️ 此前每个量都带一个写死的默认值(`|| 0.75` / `|| 0.3` / `|| 80` / `|| 0.7`),
  //    于是一个量都没测到时也能画出一张漂亮的雷达图 —— 而那五个数全是编的。
  //    "没数据"在该页必须是"数据不足",不是一张好看的图。
  // 另:这五个输入(focus_score / tension_score / hand_score / symmetry_score /
  //    gaze_stability)在**报告层都已停用**,所以这张图只是实时粗看,不是报告口径 ——
  //    报告那五维要走证据门(见 report_frontend/research_mapper.py)。
  const face = realtimeMetrics.face;
  const gesture = realtimeMetrics.gesture;
  const radarInputs: Array<[keyof typeof RADAR_LABELS, number | undefined]> = [
    ['logical_thinking', face ? Math.round(face.focus_score * 100) : undefined],
    ['stress_resilience', face ? Math.round((1 - face.tension_score) * 100) : undefined],
    ['communication_fluency', gesture ? Math.round(gesture.hand_score) : undefined],
    ['confidence_level', face ? Math.round(face.symmetry_score * 100) : undefined],
    ['cognitive_efficiency', face ? Math.round(face.gaze_stability * 100) : undefined],
  ];
  const missingRadar = radarInputs.filter(([, v]) => v === undefined)
    .map(([k]) => RADAR_LABELS[k]);
  const radarData = Object.fromEntries(
    radarInputs.map(([k, v]) => [k, v ?? 0])
  ) as { logical_thinking: number; stress_resilience: number; communication_fluency: number;
         confidence_level: number; cognitive_efficiency: number };


  useEffect(() => {
    return () => {
      stopCamera();
      stopCapture();
    };
  }, []);

  const handleStartMonitoring = async () => {
    setIsMonitoring(true);
    message.success('开始实时监控');

    await startCamera();
    setTimeout(() => {
      startCapture();
    }, 500);
  };

  const handleStopMonitoring = () => {
    setIsMonitoring(false);
    stopCapture();
    message.info('已停止监控');
  };

  return (
    <Content style={{ padding: '24px' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>实时分析</h2>
          <button
            onClick={isMonitoring ? handleStopMonitoring : handleStartMonitoring}
            style={{
              padding: '8px 24px',
              fontSize: '14px',
              background: isMonitoring ? '#ff4d4f' : '#1890ff',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            {isMonitoring ? '停止监控' : '开始监控'}
          </button>
        </div>

        {/* 视频流 */}
        {isMonitoring && (
          <Row gutter={[24, 24]} style={{ marginBottom: '24px' }}>
            <Col span={24}>
              <CameraView
                videoRef={videoRef}
                canvasRef={canvasRef}
                title="实时视频流"
              />
            </Col>
          </Row>
        )}

        {/* 第一行：三个分析卡片 */}
        <Row gutter={[24, 24]} style={{ marginBottom: '24px' }}>
          <Col xs={24} md={8}>
            <Card title="面部表情分析" variant="borderless">
              {realtimeMetrics.face ? (
                <div style={{ padding: '16px' }}>
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>情绪状态</div>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#1890ff' }}>
                      {realtimeMetrics.face.emotion === 'happy' ? '😊 开心' :
                       realtimeMetrics.face.emotion === 'sad' ? '😢 悲伤' :
                       realtimeMetrics.face.emotion === 'angry' ? '😠 愤怒' :
                       realtimeMetrics.face.emotion === 'surprised' ? '😲 惊讶' :
                       realtimeMetrics.face.emotion === 'fearful' ? '😨 恐惧' :
                       realtimeMetrics.face.emotion === 'disgusted' ? '🤢 厌恶' :
                       '😐 中性'}
                    </div>
                  </div>

                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>专注度</div>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#52c41a' }}>
                      {Math.round((realtimeMetrics.face.focus_score || 0) * 100)}%
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>紧张度</div>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#ff4d4f' }}>
                      {Math.round((realtimeMetrics.face.tension_score || 0) * 100)}%
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
                  {isMonitoring ? '等待数据...' : '点击"开始监控"'}
                </div>
              )}
            </Card>
          </Col>

          <Col xs={24} md={8}>
            <Card title="手势姿态分析" variant="borderless">
              {realtimeMetrics.gesture ? (
                <div style={{ padding: '16px' }}>
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>检测到手部</div>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#1890ff' }}>
                      {realtimeMetrics.gesture.detected_hands} 只
                    </div>
                  </div>

                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>手部姿态评分</div>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#52c41a' }}>
                      {realtimeMetrics.gesture.hand_score}/100
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>肩部稳定度</div>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#faad14' }}>
                      {realtimeMetrics.gesture.shoulder_score}/100
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
                  {isMonitoring ? '等待数据...' : '点击"开始监控"'}
                </div>
              )}
            </Card>
          </Col>

          <Col xs={24} md={8}>
            <Card title="眼动轨迹热力图" variant="borderless">
              {/* ⚠️ 这里原先喂的是 `Math.random()` 造的 10 个点 —— 一张**完全编造**的
                  轨迹热力图。报告层早就按 spec §5.5 决定不生成眼动图(现有坐标支撑不了
                  "注视"这个构念),前端却在画随机点,两处自相矛盾。宁可空着。 */}
              <div style={{ height: '200px', display: 'flex', alignItems: 'center',
                            justifyContent: 'center', color: '#999', textAlign: 'center',
                            padding: '0 24px' }}>
                待接入 —— 眼动图需要能支撑「注视」构念的坐标(现用的是画面坐标,是取景代理),
                报告层同样不出这张图
              </div>
            </Card>
          </Col>
        </Row>

        {/* 第二行：时间线和雷达图 */}
        <Row gutter={[24, 24]} style={{ marginBottom: '24px' }}>
          <Col xs={24} md={12}>
            <Card title="专注度变化趋势" variant="borderless">
              {timelineData.length > 0 ? (
                <TimelineChart
                  data={timelineData}
                  title="专注度实时曲线"
                  metricName="专注度"
                />
              ) : (
                <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
                  等待数据采集...
                </div>
              )}
            </Card>
          </Col>

          <Col xs={24} md={12}>
            <Card title="五维能力雷达图（实时粗看，非报告口径）" variant="borderless">
              {missingRadar.length === 0 ? (
                <RadarChart dimensions={radarData} />
              ) : (
                <div style={{ height: '300px', display: 'flex', alignItems: 'center',
                              justifyContent: 'center', color: '#999', textAlign: 'center',
                              padding: '0 24px' }}>
                  数据不足，暂不出图：还缺 {missingRadar.join('、')}
                </div>
              )}
            </Card>
          </Col>
        </Row>

        {/* 第三行：实时数据流 */}
        <Card title="实时数据流" variant="borderless">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
            <div style={{ padding: '16px', background: '#f0f5ff', borderRadius: '8px' }}>
              <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>AU12 (微笑)</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#2E86AB' }}>
                {(realtimeMetrics.face?.au_features?.au_12 || 0).toFixed(2)}
              </div>
            </div>
            <div style={{ padding: '16px', background: '#fff1f0', borderRadius: '8px' }}>
              <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>紧张度</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ff4d4f' }}>
                {Math.round((realtimeMetrics.face?.tension_score || 0) * 100)}%
              </div>
            </div>
            <div style={{ padding: '16px', background: '#f6ffed', borderRadius: '8px' }}>
              <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>眼神稳定性</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#52c41a' }}>
                {Math.round((realtimeMetrics.face?.gaze_stability || 0) * 100)}%
              </div>
            </div>
            <div style={{ padding: '16px', background: '#fff7e6', borderRadius: '8px' }}>
              <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>动作抖动指数</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#faad14' }}>
                {/* 同 RealtimeMetrics:判 "这一帧有没有手",不是判"有没有值" —— 
                    服务端没检测到手时仍回 0.0,那道判据等于没判 */}
                {realtimeMetrics.gesture?.hand_valid && realtimeMetrics.gesture?.jitter !== undefined
                  ? `${(realtimeMetrics.gesture.jitter * 100).toFixed(1)}%`
                  : '未检出'}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </Content>
  );
};

export default RealtimeAnalysis;

