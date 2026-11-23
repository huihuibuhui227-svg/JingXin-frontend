/**
 * 覆盖数**三段式**在前端的口径 —— 大数的分母、通过率的"不适用"分支、旧载荷兜底。
 *
 * ## 为什么这个文件存在
 *
 * 报告页原来把那句聚合数原样印成
 *
 *     8 / 14
 *     个指标槽通过证据门
 *
 * 而 14 里有 **6 个槽永远填不上**:3 个「本套采集不测」(这套采集不含这个量)、
 * 3 个「无同构念指标」(那一维要的量当前没有任何 L1 指标承接)。于是 `8/14` 被读成
 * "只覆盖了 57%",而可测量的那 8 个槽其实是 8/8 全过。
 *
 * ⟹ 后端 `l1_report.build_l1_report()` 现在把 `coverage` 拆成三段
 * (`n_measurable` / `n_not_measured` / `n_no_indicator` + `summary_line` /
 * `explanation` / `segments` / `pass_rate_of_measurable`),报告页按三段渲染。
 *
 * ## 这个文件守什么
 *
 * 1. 大数的分母是**可测量槽**(`coverageHeroNumber`),不是 `n_slots`;
 * 2. 三段(数字、标签、说明)**全部读载荷** —— 前端不数、也不自己写标签表;
 *    HTML 报告、命令行、这里三个出口各拼一套措辞,迟早说的不是同一件事;
 * 3. `pass_rate_of_measurable === null`(分母为 0)那一支**不给百分比**:
 *    0% 与 100% 都会被读成一句结论,而那时根本没有结论可言;
 * 4. 旧载荷(`l1-1`)没带分段字段时**明说"没带"**,不拿 0 顶上;
 * 5. `types/assessment.ts` 里登记了这批字段 —— 类型层是"下一个人照着旧形状渲染"
 *    的最后一道闸。
 *
 * ## 为什么是"读源码 + 断言形态"而不是 import 组件
 *
 * `ReportPage.tsx` 是 JSX,Node 的类型剥离不处理它(`npm test` 跑的是
 * `node --test src/**\/__tests__/*.test.mjs`)。本仓既有的组件级测试
 * (`vanishedDimensions.test.mjs` / `instrumentProvenance.test.mjs`)用的是同一个办法:
 * 剥掉注释后断言**会执行的那部分代码**,并对纯判断函数逐条对照文案。
 * 数字本身的行为(分母 0 → `None`、三段之和 == `n_slots`)由后端
 * `tests/test_coverage_three_segments.py` 实测,不在这里重复实现一遍。
 *
 * 怎么跑:`npm test`
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = resolve(HERE, '../ReportPage.tsx');
const TYPES = resolve(HERE, '../../types/assessment.ts');

const src = readFileSync(PAGE, 'utf8');
const types = readFileSync(TYPES, 'utf8');

/** 剥掉注释后的**会执行的代码**。
 *
 * 不剥的话,断言会匹配到说明注释里引用的那些旧写法 ——
 * 本仓已经栽过一次(`vanishedDimensions.test.mjs` 第一版匹配到的是注释)。
 */
const codeOf = (text) =>
  text
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '') // JSX 注释
    .replace(/\/\*[\s\S]*?\*\//g, '') // 普通块注释
    .split('\n')
    .map((l) => l.replace(/\/\/.*$/, ''))
    .join('\n');

const code = codeOf(src);

describe('覆盖大数:分母是可测量槽', () => {
  test('报告页用的是 coverageHeroNumber,不是自己拼 n_passed / n_slots', () => {
    assert.match(
      code,
      /coverageHeroNumber\(\s*coverage\s*\)/,
      '报告页没有走 coverageHeroNumber —— 大数的分母可能又变回了 n_slots(14)',
    );
    assert.doesNotMatch(
      code,
      /\$\{\s*coverage\.n_passed\s*\}\s*\/\s*\$\{\s*coverage\.n_slots\s*\}/,
      '大数仍是 `${coverage.n_passed} / ${coverage.n_slots}` —— 那个分母含 6 个永远填不上的槽',
    );
  });

  test('分母取的是 n_measurable;它为 0 时印「—」而不是「0 / 0」', () => {
    assert.match(
      code,
      /cov\.n_measurable/,
      'coverageHeroNumber 没有读 cov.n_measurable —— 分母从哪儿来?',
    );
    assert.match(
      code,
      /n\s*>\s*0\s*\?\s*`\$\{cov\.n_passed\}\s*\/\s*\$\{n\}`\s*:\s*'—'/,
      '可测量槽为 0 时没有单独的「—」分支 —— 会印出「0 / 0」这种假分数',
    );
  });

  test('旧载荷(没有 n_measurable)退回它自己的两个数,而不是补算一份', () => {
    assert.match(
      code,
      /typeof n !== 'number'[\s\S]{0,120}cov\.n_passed[\s\S]{0,40}cov\.n_slots/,
      '缺少 n_measurable 时的退路不见了 —— 旧载荷会渲染出 undefined',
    );
  });
});

describe('通过率的「不适用」分支', () => {
  const nullBranch = code.match(/if\s*\(\s*rate\s*===\s*null\s*\)\s*return\s*'([^']*)'/);

  test('分母为 0 有独立文案,而且里面没有百分比', () => {
    assert.ok(nullBranch, '没有 rate === null 这一支 —— 分母为 0 时会落进百分比分支');
    assert.doesNotMatch(
      nullBranch[1],
      /%/,
      `分母为 0 的分支里出现了百分比:${JSON.stringify(nullBranch[1])}`,
    );
    assert.match(nullBranch[1], /不适用/, '分母为 0 时应说「不适用」,而不是给一个数');
  });

  test('百分比只在 null 分支之后才出现(顺序不能反)', () => {
    const iNull = code.indexOf('rate === null');
    const iPct = code.indexOf('rate * 100');
    assert.ok(iNull >= 0, '没有 rate === null 判据');
    assert.ok(iPct >= 0, '没有百分比的计算 —— 那通过率根本没被用上');
    assert.ok(
      iNull < iPct,
      '百分比的计算排在了 null 判据之前 —— 分母为 0 时照样会印出 0%/100%',
    );
  });

  test('没带 pass_rate_of_measurable(旧载荷)时什么都不说', () => {
    // 数字分支之后必须还有一条 `return null;`(JSX 里据此**什么都不渲染**)——
    // 少了它,旧载荷会落进百分比分支印出 `NaN%`。
    const fn = code.slice(code.indexOf('export function coverageRateText'));
    assert.match(
      fn,
      /if \(typeof rate === 'number'\)[\s\S]{0,240}return null;/,
      '旧载荷那一支没有"什么都不说"的退路',
    );
  });
});

describe('三段:数字与措辞都读载荷', () => {
  test('三段渲染自 coverage.segments(不自己数)', () => {
    assert.match(code, /coverage\.segments/, '报告页没有读 coverage.segments');
    for (const field of ['seg.label', 'seg.n', 'seg.note']) {
      assert.ok(code.includes(field), `三段没有渲染 ${field} —— 那一列会是空的`);
    }
    // `seg.n_passed` 只有第一段有值:null 时不画"通过 N/M"
    assert.match(
      code,
      /seg\.n_passed\s*!==\s*null/,
      '没有判 seg.n_passed 是否为 null —— 另外两段会印出「通过 0 / 3」',
    );
  });

  test('前端没有第二张标签表(措辞不许自己写)', () => {
    for (const label of ['本套采集不测', '无同构念指标']) {
      assert.ok(
        !code.includes(label),
        `ReportPage 里硬写了解释标签「${label}」—— 它会与后端载荷里的说法分叉`,
      );
    }
  });

  test('解释那句也读载荷(coverage.explanation)', () => {
    assert.match(
      code,
      /coverage\.explanation/,
      '没有渲染 coverage.explanation —— 「为什么不测」那句会缺',
    );
  });

  test('旧载荷没带三段时明说"没带",不拿 0 顶上', () => {
    assert.match(
      code,
      /没带分段覆盖数/,
      '缺少 segments 时的说明不见了 —— 旧载荷下这一段会静默消失',
    );
  });
});

describe('类型层登记了这批字段', () => {
  test('Coverage 上三个分段数与通过率', () => {
    assert.match(types, /n_measurable\?\s*:\s*number/, 'assessment.ts 没登记 n_measurable');
    assert.match(types, /n_not_measured\?\s*:\s*number/, 'assessment.ts 没登记 n_not_measured');
    assert.match(types, /n_no_indicator\?\s*:\s*number/, 'assessment.ts 没登记 n_no_indicator');
    assert.match(
      types,
      /pass_rate_of_measurable\?\s*:\s*number\s*\|\s*null/,
      'pass_rate_of_measurable 的类型必须是 `number | null` —— 分母为 0 时给的是 null',
    );
  });

  test('三段明细与那句话', () => {
    assert.match(types, /segments\?\s*:\s*CoverageSegment\[\]/, 'assessment.ts 没登记 segments');
    assert.match(types, /summary_line\?\s*:\s*string/, 'assessment.ts 没登记 summary_line');
    assert.match(types, /explanation\?\s*:\s*string/, 'assessment.ts 没登记 explanation');
    assert.match(types, /export interface CoverageSegment/, '没有 CoverageSegment 这个类型');
    assert.match(
      types,
      /n_passed:\s*number\s*\|\s*null/,
      'CoverageSegment.n_passed 必须是 `number | null`(后两段没有"通过"这回事)',
    );
  });
});
