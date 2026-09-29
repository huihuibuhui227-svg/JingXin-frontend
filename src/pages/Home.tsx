import React, { useEffect, useState } from 'react';
import { Button, Row, Col, Typography, Skeleton, Space } from 'antd';
import { useNavigate } from 'react-router-dom';
import { dashboardApi } from '@/services/api';
import { recordingsApi } from '@/services/recordingsApi';

const { Text } = Typography;

const fmtBytes = (n: number): string => {
  if (!n) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${u[i]}`;
};

/**
 * 首页 —— 按 DESIGN.md 的「交替全宽 tile」结构重做。
 *
 * 规范原文：「每一页都是叠起来的全宽产品 tile —— 交替的浅色与深色画布，
 * 每个 tile 居中一张主标题、一行副标、两个小小的蓝色胶囊 CTA。什么都不与
 * 产品争抢。」以及「面色变化本身就是分隔」。
 *
 * 所以这里：**不用卡片分隔，用整条的面色切换**。
 *   浅 tile（hero）→ 深 tile（盘上实况）→ 米白 tile（两条入口）
 *
 * ⚠️ 数据必须真实。「读不到」和「没有」要分开说 —— 这是本仓一贯的形态要求，
 * 而"装作没有"恰恰是 AI 生成界面的典型毛病（永远显示「暂无数据」）。
 */
const Home: React.FC = () => {
  const navigate = useNavigate();

  const [reportCount, setReportCount] = useState<number | null>(null);
  const [recStats, setRecStats] = useState<{ n: number; bytes: number } | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    dashboardApi
      .getFiles('reports')
      .then((files: Array<{ name: string }>) =>
        setReportCount(files.filter((f) => /Assessment_Report.*\.html$/i.test(f.name)).length)
      )
      .catch(() => setLoadError(true));
    recordingsApi
      .list()
      .then((r) => setRecStats({ n: r.recordings.length, bytes: r.total_video_bytes }))
      .catch(() => setLoadError(true));
  }, []);

  return (
    // ⚠️ 必须是 <main>：本页没用 antd 的 Layout.Content(它自带 main),
    //    重构成 section tile 时曾把这一层弄丢,axe 立刻报 landmark-one-main / region。
    <main>
      {/* ══ Tile 1 · 浅色 hero ══════════════════════════════════
          规范：主标题 display-lg 40px/600，副标 lead 28px/400，
          两个蓝色胶囊 CTA。居中单列。 */}
      <section className="ax-tile ax-tile--light">
        <div className="ax-tile__inner" style={{ textAlign: 'center' }}>
          <h1
            className="ax-display-lg"
            style={{ margin: '0 auto', maxWidth: 720, color: 'var(--ax-ink)' }}
          >
            多模态面试与科研评估
          </h1>
          <p
            className="ax-lead"
            style={{
              margin: '17px auto 0',
              maxWidth: 760,
              color: 'var(--ax-text-secondary)'
            }}
          >
            从面部表情、手势姿态、语音内容与眼动轨迹，得到可复核的行为记录。
          </p>

          {/* 两个胶囊 CTA：主（Action Blue）+ 次级（幽灵胶囊） */}
          <Space size={16} style={{ marginTop: 32 }} wrap>
            <Button
              type="primary"
              className="ax-btn--pill"
              size="large"
              onClick={() => navigate('/interview')}
            >
              开始面试评估
            </Button>
            <Button
              className="ax-btn--pill ax-btn--ghost"
              size="large"
              onClick={() => navigate('/research')}
            >
              开始科研评估
            </Button>
          </Space>
        </div>
      </section>

      {/* ══ Tile 2 · 深色 —— 盘上实况 ═══════════════════════════
          规范：深色 tile 用 #272729，文字纯白，链接用 Sky Link Blue。
          面色切换本身就是分隔，不需要边框或投影。 */}
      <section className="ax-tile ax-tile--dark">
        <div className="ax-tile__inner">
          <h2
            className="ax-display-md"
            style={{
              fontSize: 24,
              margin: 0,
              color: 'var(--ax-on-dark)',
              textAlign: 'center'
            }}
          >
            盘上实况
          </h2>
          <p
            style={{
              margin: '8px 0 40px',
              textAlign: 'center',
              color: 'var(--ax-body-muted)',
              fontSize: 'var(--ax-caption-size)'
            }}
          >
            所测即所得 —— 读不到就如实说读不到
          </p>

          {loadError && (
            <p
              style={{
                margin: '0 auto 32px',
                maxWidth: 560,
                textAlign: 'center',
                color: '#ff9f9f',
                fontSize: 'var(--ax-caption-size)'
              }}
            >
              有一项目录没读到（后端没起？）—— 下面的数字可能不完整。
            </p>
          )}

          <Row gutter={[24, 24]} justify="center">
            <Col xs={24} sm={12} md={10}>
              <button
                className="ax-press"
                onClick={() => navigate('/reports')}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  background: 'var(--ax-tile-3)',
                  border: '1px solid rgba(255,255,255,0.18)',
                  borderRadius: 'var(--ax-rounded-lg)',
                  padding: 'var(--ax-space-lg)',
                  cursor: 'pointer',
                  color: 'var(--ax-on-dark)',
                  fontFamily: 'var(--ax-font-text)'
                }}
              >
                <div
                  style={{
                    fontSize: 'var(--ax-caption-size)',
                    color: 'var(--ax-body-muted)',
                    letterSpacing: 'var(--ax-caption-ls)'
                  }}
                >
                  历史报告
                </div>
                <div
                  className="ax-display-lg"
                  style={{ marginTop: 8, fontSize: 40, color: 'var(--ax-on-dark)' }}
                >
                  {reportCount === null ? '—' : reportCount}
                  <span
                    style={{
                      fontSize: 'var(--ax-body-size)',
                      fontWeight: 400,
                      marginLeft: 8,
                      color: 'var(--ax-body-muted)'
                    }}
                  >
                    份
                  </span>
                </div>
                <div
                  style={{
                    marginTop: 12,
                    fontSize: 'var(--ax-caption-size)',
                    color: 'var(--ax-primary-on-dark)'
                  }}
                >
                  {reportCount === null
                    ? '读取中…'
                    : reportCount === 0
                      ? '还没有生成过报告 —— 报告不会自动生成，要手动跑一次。'
                      : '查看全部 ›'}
                </div>
              </button>
            </Col>

            <Col xs={24} sm={12} md={10}>
              <button
                className="ax-press"
                onClick={() => navigate('/recordings')}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  background: 'var(--ax-tile-3)',
                  border: '1px solid rgba(255,255,255,0.18)',
                  borderRadius: 'var(--ax-rounded-lg)',
                  padding: 'var(--ax-space-lg)',
                  cursor: 'pointer',
                  color: 'var(--ax-on-dark)',
                  fontFamily: 'var(--ax-font-text)'
                }}
              >
                <div
                  style={{
                    fontSize: 'var(--ax-caption-size)',
                    color: 'var(--ax-body-muted)',
                    letterSpacing: 'var(--ax-caption-ls)'
                  }}
                >
                  历史录制素材
                </div>
                {recStats === null ? (
                  <Skeleton
                    active
                    paragraph={{ rows: 1 }}
                    title={{ width: '40%' }}
                    style={{ marginTop: 12 }}
                  />
                ) : (
                  <>
                    <div
                      className="ax-display-lg"
                      style={{ marginTop: 8, fontSize: 40, color: 'var(--ax-on-dark)' }}
                    >
                      {recStats.n}
                      <span
                        style={{
                          fontSize: 'var(--ax-body-size)',
                          fontWeight: 400,
                          marginLeft: 8,
                          color: 'var(--ax-body-muted)'
                        }}
                      >
                        场
                      </span>
                    </div>
                    <div
                      style={{
                        marginTop: 12,
                        fontSize: 'var(--ax-caption-size)',
                        color: 'var(--ax-primary-on-dark)'
                      }}
                    >
                      原生录像合计 {fmtBytes(recStats.bytes)} · 浏览回放与删除 ›
                    </div>
                  </>
                )}
              </button>
            </Col>
          </Row>
        </div>
      </section>

      {/* ══ Tile 3 · 米白 —— 两条入口 ══════════════════════════
          规范：parchment 用来打断两个连续的白 tile。 */}
      <section className="ax-tile ax-tile--parchment">
        <div className="ax-tile__inner">
          <h2
            className="ax-display-md"
            style={{ fontSize: 24, margin: '0 0 32px', color: 'var(--ax-ink)' }}
          >
            开始一次评估
          </h2>

          <Row gutter={[24, 24]}>
            {[
              {
                title: '面试评估',
                desc: '企业招聘、人才选拔',
                to: '/interview',
                cta: '开始面试评估'
              },
              {
                title: '科研评估',
                desc: '研究生入学、科研项目选拔',
                to: '/research',
                cta: '开始科研评估'
              }
            ].map((item) => (
              <Col xs={24} md={12} key={item.to}>
                {/* 工具卡片：白底 + 1px hairline + 18px 圆角 + 24px 内距，无投影 */}
                <div
                  className="ax-card"
                  style={{
                    background: 'var(--ax-canvas)',
                    border: '1px solid var(--ax-hairline)',
                    borderRadius: 'var(--ax-rounded-lg)',
                    padding: 'var(--ax-space-lg)',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column'
                  }}
                >
                  <h3
                    style={{
                      margin: 0,
                      fontFamily: 'var(--ax-font-display)',
                      fontSize: 21,
                      fontWeight: 600,
                      letterSpacing: 'var(--ax-tagline-ls)',
                      color: 'var(--ax-ink)'
                    }}
                  >
                    {item.title}
                  </h3>
                  <p
                    style={{
                      margin: '8px 0 20px',
                      color: 'var(--ax-text-secondary)',
                      fontSize: 'var(--ax-caption-size)',
                      flex: 1
                    }}
                  >
                    {item.desc}
                  </p>
                  <Button
                    type="primary"
                    className="ax-btn--pill"
                    onClick={() => navigate(item.to)}
                    style={{ alignSelf: 'flex-start' }}
                  >
                    {item.cta}
                  </Button>
                </div>
              </Col>
            ))}
          </Row>

          {/* 次级入口：一行文字链接（规范：text-link 用 Action Blue） */}
          <div
            style={{
              marginTop: 32,
              paddingTop: 24,
              borderTop: '1px solid var(--ax-hairline)',
              display: 'flex',
              gap: 24,
              flexWrap: 'wrap',
              alignItems: 'center'
            }}
          >
            <Text style={{ color: 'var(--ax-text-secondary)', fontSize: 'var(--ax-caption-size)' }}>
              其它
            </Text>
            {[
              { to: '/analysis', label: '实时分析' },
              { to: '/reports', label: '报告列表' },
              { to: '/recordings', label: '录制素材' }
            ].map((l) => (
              <button
                key={l.to}
                onClick={() => navigate(l.to)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  color: 'var(--ax-primary)',
                  fontSize: 'var(--ax-body-size)',
                  fontFamily: 'var(--ax-font-text)'
                }}
              >
                {l.label} ›
              </button>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
};

export default Home;
