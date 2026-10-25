/**
 * 「整维未出」那块卡片不许印内部记号 —— 交付物说人话,报告页也一样。
 *
 * ## 为什么
 *
 * `ReportViewer` 原来是这样渲染的:
 *
 *     {v.dropped.map((d) => `${d.slot}：${d.reason}`).join('；')}
 *
 * 于是报告页上读者看到:
 *
 *     left_hand_spread：hand_visible_ratio_l 量的是**可见性**,不是手掌张开度
 *
 * 一次三样开发者记号:内部槽键、内部 L1 指标名、markdown 星号(React 会把它
 * 当字面星号印出来)。
 *
 * 后端 HTML 报告早就改成走 `l1_mapper.slot_label` / `drop_reason` 那层人话;
 * 前端是**同一个载荷的另一个出口**,不该有两套口径。
 *
 * 前端没有、也不该有槽名对照表(两张表迟早分叉)⟹ 人话由载荷给:
 * `human_name` / `plain_reason`(2026-10-25 起 `build_l1_report` 逐槽补上,
 * 审计字段 `slot` / `reason` 原样保留)。
 *
 * ## 这个文件守什么
 *
 * 1. `ReportViewer` 印的是 `human_name` / `plain_reason`,不是 `slot` / `reason`;
 * 2. 载荷缺人话字段时**退回**内部字段(宁可露出英文,也不许把那一条吞掉);
 * 3. 类型定义里登记了这两个字段 —— 否则下一个人照着旧类型渲染又漏回去。
 *
 * 怎么跑:`npm test`
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const VIEWER = resolve(HERE, '../ReportViewer.tsx');
const TYPES = resolve(HERE, '../../../types/assessment.ts');

const src = readFileSync(VIEWER, 'utf8');
const types = readFileSync(TYPES, 'utf8');

/** 剥掉注释后的**会执行的代码**。
 *
 * ⚠️ 只看源码原文是不够的:本文件的说明注释里就写着 `human_name` / `plain_reason` /
 * `d.slot` 这些名字(那是在解释为什么不用它们)。第一版拿原文做断言,实测
 * 「印的是人话字段」在把渲染改回 `d.slot` 之后**照样绿** —— 它匹配到的是注释。
 */
const codeOf = (text) =>
  text
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '') // JSX 注释
    .replace(/\/\*[\s\S]*?\*\//g, '') // 普通块注释
    .split('\n')
    .map((l) => l.replace(/\/\/.*$/, ''))
    .join('\n');

const code = codeOf(src);

describe('整维未出的渲染', () => {
  test('印的是人话字段', () => {
    assert.match(code, /human_name/, 'ReportViewer 没有用 human_name —— 读者只能看到内部槽键');
    assert.match(code, /plain_reason/, 'ReportViewer 没有用 plain_reason —— 读者只能看到审计串');
  });

  test('不再直接印 slot / reason', () => {
    // `d.slot` / `d.reason` 只允许出现在 `??` 的**右边**(旧载荷的退回路径)。
    // 直接印 `d.slot` 就是内部槽键,直接印 `d.reason` 就是审计细节。
    for (const field of ['slot', 'reason']) {
      const re = new RegExp(`d\\.${field}`, 'g');
      let m;
      while ((m = re.exec(code)) !== null) {
        const before = code.slice(Math.max(0, m.index - 8), m.index);
        assert.match(
          before,
          /\?\?\s*$/,
          `代码里直接印了 d.${field}(前文 ${JSON.stringify(before)})—— ` +
            (field === 'slot'
              ? '那是内部槽键,读者不认识'
              : '那是审计细节(点名内部指标名),不该进交付物'),
        );
      }
    }
  });

  test('人话字段缺席时退回内部字段,而不是把这一条吞掉', () => {
    // 载荷可能来自旧版本(没有 human_name)。宁可露出英文,也不许静默少一条 ——
    // 这是本仓反复栽的形态(失败被降级成"看不见")。
    assert.match(
      code,
      /d\.human_name\s*\?\?\s*d\.slot|d\.slot\s*\?\?/,
      '缺少 human_name 时的退回写法不见了 —— 旧载荷下这一条会静默消失',
    );
  });

  test('类型定义里登记了这两个字段', () => {
    for (const field of ['human_name', 'plain_reason']) {
      assert.match(
        types,
        new RegExp(`${field}\\s*\\??:`),
        `assessment.ts 的 VanishedDimension 没登记 ${field}`,
      );
    }
  });
});
