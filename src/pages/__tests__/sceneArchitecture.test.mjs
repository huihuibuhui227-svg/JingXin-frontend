/**
 * 一核三基地架构、无影像隐私挡位与纵向断线守卫的前端结构测试。
 * 与同目录其他测试一致：剥离注释后校验关键不变量。
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = resolve(HERE, '../..');

const codeOf = (text) =>
  text
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((l) => l.replace(/\/\/.*$/, ''))
    .join('\n');

describe('一核三基地路由与导航完整性', () => {
  test('App.tsx 注册三大基地、专属门户 Hub 及多场对比全部路由', () => {
    const appCode = codeOf(readFileSync(resolve(SRC_ROOT, 'App.tsx'), 'utf8'));
    for (const route of [
      '/hub/research',
      '/hub/metacognition',
      '/hub/followup',
      '/career-mcp',
      '/metacognition',
      '/followup',
      '/followup/capture',
      '/compare',
    ]) {
      assert.match(appCode, new RegExp(`path=["']${route}["']`), `App.tsx 缺少路由 ${route}`);
    }
  });

  test('Header.tsx 保持两行式聚焦分组导航且包含三基地入口', () => {
    const headerCode = codeOf(readFileSync(resolve(SRC_ROOT, 'components/common/Header.tsx'), 'utf8'));
    for (const groupPath of ["'/research'", "'/career-mcp'", "'/followup'", "'/reports'"]) {
      assert.match(headerCode, new RegExp(groupPath), `Header 缺少分组 ${groupPath}`);
    }
    for (const hubPath of ["'/hub/research'", "'/hub/metacognition'", "'/hub/followup'"]) {
      assert.match(headerCode, new RegExp(hubPath), `Header 缺少门户入口 ${hubPath}`);
    }
  });

  test('Home.tsx 与 RealtimeAnalysis.tsx 不暴露内部端口号或内部工具名', () => {
    for (const rel of ['pages/Home.tsx', 'pages/RealtimeAnalysis.tsx']) {
      const code = codeOf(readFileSync(resolve(SRC_ROOT, rel), 'utf8'));
      for (const port of [':8000', ':8001', ':8002', ':5000', ':8081', ':10095']) {
        assert.equal(code.includes(port), false, `${rel} 不允许向用户暴露端口 ${port}`);
      }
      for (const jargon of ['FunASR', 'Parselmouth', 'RTMW', 'Silero']) {
        assert.equal(code.includes(jargon), false, `${rel} 不允许暴露底层引擎名词 ${jargon}`);
      }
    }
  });

  test('ReportPage.tsx 将可读叙事报告置于正文核心并接入多视角切换', () => {
    const reportCode = codeOf(readFileSync(resolve(SRC_ROOT, 'pages/ReportPage.tsx'), 'utf8'));
    assert.match(reportCode, /ax-narrative-paper/, 'ReportPage 缺少可读叙事纸张容器');
    assert.match(reportCode, /reportLlmAssist/, 'ReportPage 未调用可读报告生成接口');
    assert.match(reportCode, /narrative_review/, 'ReportPage 缺少导师审阅版视角');
    assert.match(reportCode, /participant_feedback/, 'ReportPage 缺少个人成长版视角');
  });
});

describe('第三隐私挡位与随访合规守卫', () => {
  test('ConsentMode 与 api.ts 全链路透传 X-Privacy-Mode = anonymous_kinematics_only', () => {
    const dialogsCode = codeOf(readFileSync(resolve(SRC_ROOT, 'components/recording/RecordingDialogs.tsx'), 'utf8'));
    const apiCode = codeOf(readFileSync(resolve(SRC_ROOT, 'services/api.ts'), 'utf8'));
    const recCode = codeOf(readFileSync(resolve(SRC_ROOT, 'hooks/useSessionRecording.ts'), 'utf8'));

    assert.match(dialogsCode, /anonymous_kinematics_only/);
    assert.match(apiCode, /'X-Privacy-Mode':\s*effective/);
    assert.match(recCode, /setPrivacyMode\(mode\)/);
  });

  test('LongitudinalTrajectorySvg 遇缺口(null)或 !comparable 显式断开折线不补零且支持 EWMA', () => {
    const svgCode = codeOf(readFileSync(resolve(SRC_ROOT, 'components/report/LongitudinalTrajectorySvg.tsx'), 'utf8'));
    assert.match(svgCode, /if\s*\(\s*comparable\s*\)/, '缺少 comparable 连线守卫');
    assert.match(svgCode, /if\s*\(\s*currentRun\.length\s*>=\s*2\s*\)\s*segments\.push/, '遇缺失点未拆段');
    assert.match(svgCode, /ewma_value/, '缺少 EWMA 平滑轨迹绘制');
    assert.match(svgCode, /drift_status/, '缺少访次稳健偏离状态展示');
  });

  test('随访、求职及三大门户 Hub 页面严禁出现打分或临床词汇', () => {
    for (const rel of [
      'pages/Home.tsx',
      'pages/ResearchHubPage.tsx',
      'pages/MetacognitionHubPage.tsx',
      'pages/FollowupHubPage.tsx',
      'pages/CareerMcpPage.tsx',
      'pages/FollowupPage.tsx',
      'pages/FollowupCapture.tsx',
    ]) {
      const pageText = readFileSync(resolve(SRC_ROOT, rel), 'utf8');
      for (const bad of ['患者', '抑郁', '焦虑', '推荐录用', '能力等级']) {
        assert.equal(pageText.includes(bad), false, `${rel} 不允许出现禁止词「${bad}」`);
      }
    }
  });
});
