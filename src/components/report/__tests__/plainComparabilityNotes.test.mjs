/**
 * 「比较陷阱」那段要印**人话版**,不印 `旧槽键 → L1指标名`。
 *
 * ## 为什么
 *
 * `l1.comparability_notes` 每条形如:
 *
 *     connective_density → discourse_marker_rate：旧 = **不同**标记出现过几次…
 *
 * 前端 `L1IndicatorTable` 原样印了(只剥了 `**`),于是报告页上读者看到
 * 一串内部槽键与内部 L1 指标名。后端 HTML 报告同样如此 —— 2026-10-25 晚
 * 由 `test_dropped_slot_reasons_in_the_report_are_plain_chinese` 抓到,
 * 一共 6 个内部指标名进了交付物正文。
 *
 * 修法与「删槽理由」那次相同:**载荷发两版**,渲染层各取所需:
 *  · `comparability_notes`       —— 审计版,核对口径的人查映射;
 *  · `comparability_notes_plain` —— 人话版,界面与交付物都印这一版。
 *
 * 前端没有、也不该有对照表(两张表迟早分叉)。
 *
 * ## 这个文件守什么
 *
 * 1. 组件读的是 `comparability_notes_plain`,不是审计版;
 * 2. 载荷没发人话版时**退回**审计版(宁可露出英文,不许把这一条吞掉);
 * 3. 类型定义里登记了 `comparability_notes_plain`。
 *
 * 怎么跑:`npm test`
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const TABLE = resolve(HERE, '../L1IndicatorTable.tsx');
const TYPES = resolve(HERE, '../../../types/assessment.ts');

/** 去掉注释再断言 —— 注释里会提到字段名,直接扫源码会把注释当成渲染。 */
const codeOf = (text) =>
  text
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((l) => l.replace(/\/\/.*$/, ''))
    .join('\n');

const src = codeOf(readFileSync(TABLE, 'utf8'));

describe('比较陷阱那段', () => {
  test('读的是载荷发来的人话版', () => {
    assert.ok(
      src.includes('comparability_notes_plain'),
      '组件没读 `comparability_notes_plain` —— 它会退回印内部槽键与 L1 指标名',
    );
  });

  test('人话版缺席时退回审计版,不吞掉这一段', () => {
    // 退回的形状必须是 `plain 版 ?? 审计版`;只写审计版就没有分层,
    // 只写人话版就会在旧载荷上整段消失。
    const m = src.match(/comparability_notes_plain[\s\S]{0,200}?comparability_notes/);
    assert.ok(m, '没有「人话版 ?? 审计版」的退回链 —— 旧载荷上这一段会整段消失');
    assert.ok(
      /\?\?|\.length/.test(m[0]),
      '退回链里没有可选/兜底写法,人话版缺席时会拿到 undefined',
    );
  });

  test('不再直接拿审计版渲染列表', () => {
    // `comparability_notes!` / `comparability_notes?.map` 这种直接渲染是旧写法。
    const direct = src.match(/comparability_notes[?!]?\.(map|length)/);
    assert.equal(
      direct,
      null,
      `组件还在直接渲染审计版(${direct?.[0]}) —— 那会印出内部指标名`,
    );
  });
});

describe('类型定义', () => {
  test('登记了 comparability_notes_plain', () => {
    const types = codeOf(readFileSync(TYPES, 'utf8'));
    assert.ok(
      types.includes('comparability_notes_plain'),
      '`L1Audit` 没登记 `comparability_notes_plain` —— 下一个人会照着旧类型渲染回审计版',
    );
  });
});
