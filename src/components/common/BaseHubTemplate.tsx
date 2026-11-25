import React, { useEffect, useState } from 'react';
import { Button, Card, Col, Row, Space, Tag, Typography } from 'antd';
import { ArrowLeftOutlined, ArrowRightOutlined, BookOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { sceneProfilesApi, SceneProfileDescriptor, SceneProfileTheoreticalFoundation } from '@/services/api';

const { Paragraph, Text } = Typography;

export interface HubWorkflowCard {
  to: string;
  title: string;
  desc: string;
  action: string;
  icon: React.ReactNode;
}

export interface BaseHubProps {
  profileId: 'research_interview' | 'ai_metacognition' | 'longitudinal_followup';
  themeKey: 'b1' | 'b2' | 'b3';
  title: string;
  englishTag: string;
  weightLabel: string;
  subtitle: string;
  workflows: HubWorkflowCard[];
  fallbackFoundation: Required<SceneProfileTheoreticalFoundation>;
  fallbackCompliance: string;
  fallbackBlocked: Array<{ key: string; label: string; reason: string }>;
}

const THEME_TOKENS: Record<
  'b1' | 'b2' | 'b3',
  { accent: string; soft: string; border: string; heroClass: string }
> = {
  b1: {
    accent: 'var(--ax-b1)',
    soft: 'var(--ax-b1-soft)',
    border: 'var(--ax-b1-border)',
    heroClass: 'ax-hub-hero ax-hub-hero--b1',
  },
  b2: {
    accent: 'var(--ax-b2)',
    soft: 'var(--ax-b2-soft)',
    border: 'var(--ax-b2-border)',
    heroClass: 'ax-hub-hero ax-hub-hero--b2',
  },
  b3: {
    accent: 'var(--ax-b3)',
    soft: 'var(--ax-b3-soft)',
    border: 'var(--ax-b3-border)',
    heroClass: 'ax-hub-hero ax-hub-hero--b3',
  },
};

const BaseHubTemplate: React.FC<BaseHubProps> = ({
  profileId,
  themeKey,
  title,
  englishTag,
  weightLabel,
  subtitle,
  workflows,
  fallbackFoundation,
  fallbackCompliance,
  fallbackBlocked,
}) => {
  const navigate = useNavigate();
  const [liveProfile, setLiveProfile] = useState<SceneProfileDescriptor | null>(null);

  useEffect(() => {
    let active = true;
    sceneProfilesApi
      .get(profileId)
      .then((res) => {
        if (active && res?.profile) {
          setLiveProfile(res.profile);
        }
      })
      .catch(() => {
        // 离线或服务未启动时平滑回退至本地内置档案说明
      });
    return () => {
      active = false;
    };
  }, [profileId]);

  const tone = THEME_TOKENS[themeKey];
  const displayWeight = liveProfile?.weight_label || weightLabel;
  const displayEnglish = liveProfile?.english_tag || englishTag;
  const displayDesc = liveProfile?.description || subtitle;
  const displayCompliance = liveProfile?.compliance_banner || fallbackCompliance;
  const foundation = liveProfile?.theoretical_foundation;
  const framework = foundation?.framework || fallbackFoundation.framework;
  const corePrinciple = foundation?.core_principle || fallbackFoundation.core_principle;
  const constructs =
    foundation?.key_constructs && foundation.key_constructs.length > 0
      ? foundation.key_constructs
      : fallbackFoundation.key_constructs;
  const references =
    foundation?.references && foundation.references.length > 0
      ? foundation.references
      : fallbackFoundation.references;
  const blockedItems =
    liveProfile?.explicit_blocked_overrides && liveProfile.explicit_blocked_overrides.length > 0
      ? liveProfile.explicit_blocked_overrides
      : fallbackBlocked;

  const colSpanMd = workflows.length === 2 ? 12 : 8;

  return (
    <main className="ax-reading" style={{ padding: '28px 24px 64px' }}>
      <div className="ax-reading__inner">
        <div style={{ marginBottom: 16 }}>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/')}
            style={{ paddingInline: 6, color: 'var(--ax-text-secondary)', fontWeight: 400 }}
          >
            返回总门户
          </Button>
        </div>

        <section className={tone.heroClass} aria-label={title}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '3px 12px',
                borderRadius: 'var(--ax-rounded-pill)',
                background: tone.soft,
                border: `1px solid ${tone.border}`,
                color: tone.accent,
                fontSize: 12.5,
                fontWeight: 600,
              }}
            >
              {displayWeight}
            </span>
            <span style={{ fontSize: 12.5, color: 'var(--ax-text-secondary)', letterSpacing: '0.02em' }}>
              {displayEnglish}
            </span>
          </div>

          <h1
            className="ax-display-md"
            style={{ margin: 0, color: 'var(--ax-ink)', fontWeight: 600 }}
          >
            {title}
          </h1>

          <Paragraph
            style={{
              margin: '12px 0 0',
              maxWidth: 780,
              fontSize: 16,
              lineHeight: 1.75,
              color: 'var(--ax-text-secondary)',
            }}
          >
            {displayDesc}
          </Paragraph>
        </section>

        <section aria-label="场景工作流入口" style={{ marginBottom: 28 }}>
          <Row gutter={[24, 24]}>
            {workflows.map((wf) => (
              <Col xs={24} md={colSpanMd} key={wf.to}>
                <button
                  type="button"
                  onClick={() => navigate(wf.to)}
                  className="ax-card ax-card--interactive ax-press"
                  style={{
                    width: '100%',
                    height: '100%',
                    padding: '26px 24px',
                    textAlign: 'left',
                    fontFamily: 'var(--ax-font-text)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 18,
                  }}
                >
                  <div>
                    <span
                      aria-hidden="true"
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 'var(--ax-rounded-md)',
                        background: tone.soft,
                        border: `1px solid ${tone.border}`,
                        color: tone.accent,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 18,
                        marginBottom: 16,
                      }}
                    >
                      {wf.icon}
                    </span>
                    <h2 style={{ margin: '0 0 8px', fontSize: 19, fontWeight: 600, color: 'var(--ax-ink)' }}>
                      {wf.title}
                    </h2>
                    <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.65, color: 'var(--ax-text-secondary)' }}>
                      {wf.desc}
                    </p>
                  </div>

                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 14,
                      fontWeight: 600,
                      color: tone.accent,
                    }}
                  >
                    <span>{wf.action}</span>
                    <ArrowRightOutlined style={{ fontSize: 12 }} />
                  </div>
                </button>
              </Col>
            ))}
          </Row>
        </section>

        <Card
          className="ax-card"
          title={
            <Space size={8}>
              <BookOutlined style={{ color: tone.accent }} />
              <span>理论依据与测量边界</span>
            </Space>
          }
          bodyStyle={{ padding: '24px 28px' }}
        >
          <Row gutter={[28, 20]}>
            <Col xs={24} lg={14}>
              <div style={{ marginBottom: 14 }}>
                <Text strong style={{ fontSize: 14, color: 'var(--ax-ink)' }}>
                  方法学框架：{framework}
                </Text>
                <p style={{ margin: '6px 0 0', fontSize: 14.5, lineHeight: 1.75, color: 'var(--ax-text-secondary)' }}>
                  {corePrinciple}
                </p>
              </div>

              {constructs.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ax-ink)', marginBottom: 8 }}>
                    核心观测构念
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {constructs.map((c) => (
                      <Tag
                        key={c}
                        style={{
                          margin: 0,
                          color: tone.accent,
                          background: tone.soft,
                          borderColor: tone.border,
                        }}
                      >
                        {c}
                      </Tag>
                    ))}
                  </div>
                </div>
              )}

              {references.length > 0 && (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ax-ink)', marginBottom: 6 }}>
                    同行评议文献参考
                  </div>
                  <ul
                    style={{
                      margin: 0,
                      paddingLeft: 18,
                      fontSize: 13,
                      lineHeight: 1.7,
                      color: 'var(--ax-text-secondary)',
                    }}
                  >
                    {references.map((ref) => (
                      <li key={ref}>{ref}</li>
                    ))}
                  </ul>
                </div>
              )}
            </Col>

            <Col xs={24} lg={10}>
              <div
                style={{
                  background: 'var(--ax-parchment)',
                  border: '1px solid var(--ax-hairline)',
                  borderRadius: 'var(--ax-rounded-md)',
                  padding: '18px 20px',
                  height: '100%',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <SafetyCertificateOutlined style={{ color: tone.accent, fontSize: 16 }} />
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ax-ink)' }}>
                    非评分红线与主动封停项
                  </span>
                </div>

                <p style={{ margin: '0 0 14px', fontSize: 13.5, lineHeight: 1.65, color: 'var(--ax-text-secondary)' }}>
                  {displayCompliance}
                </p>

                <div style={{ display: 'grid', gap: 10 }}>
                  {blockedItems.map((item) => (
                    <div
                      key={item.key}
                      style={{
                        background: 'var(--ax-canvas)',
                        border: '1px solid var(--ax-hairline)',
                        borderRadius: 'var(--ax-rounded-sm)',
                        padding: '10px 12px',
                      }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ax-warning)' }}>
                        已禁用：{item.label}
                      </div>
                      <div style={{ fontSize: 12.5, lineHeight: 1.55, color: 'var(--ax-text-secondary)', marginTop: 3 }}>
                        {item.reason}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Col>
          </Row>
        </Card>
      </div>
    </main>
  );
};

export default BaseHubTemplate;
