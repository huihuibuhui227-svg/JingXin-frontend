/**
 * 「置信度为「低」的原因」那段要印**人话版**,不印 `speech_rate:理由`。
 *
 * ## 实测缺陷(2026-10-25 深夜,服务器上真跑的一场 `20260928_180131_8102`)
 *
 * 交付物正文里印着:
 *
 *     · speech_rate:整场只有一次测量(转写字数 ÷ 有声秒数)…
 *     · pause_rate_per_min:整场只有一次测量(停顿段数 ÷ 有声分钟数)…
 *
 * 5 个内部指标名进了读者眼前。理由写得很清楚,但**读者不知道说的是哪个指标** ——
 * 同一份报告的维度表里,同一个指标印的是中文槽名(「语调变化」「平均停顿时长」)。
 * 一个东西两个名字,读者会以为是两个东西。
 *
 * ## 修法(与 `comparability_notes` 那次同一套分层)
 *
 * 载荷发两版:`low_confidence_notes`(审计版)+ `low_confidence_notes_plain`(人话版)。
 * 渲染层印人话版;载荷没发时**退回**审计版 —— 宁可露出英文,不许把这一段吞掉。
 *
 * ## 这个文件守什么
 *
 * 1. 组件读的是人话版;
 * 2. 人话版缺席时退回审计版(两处:守卫与 `.map`);
 * 3. 类型定义里登记了它。
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

describe('「置信度为低的原因」那段', () => {
  test('读的是载荷发来的人话版', () => {
    assert.ok(
      src.includes('low_confidence_notes_plain'),
      '组件没读 `low_confidence_notes_plain` —— 它会印出 speech_rate 这类内部键',
    );
  });

  test('人话版缺席时退回审计版,不吞掉这一段', () => {
    /* 退回的形状必须是 `plain 版 ?? 审计版`;只写审计版就没有分层,
       只写人话版就会在旧载荷上整段消失。
       ⚠️ 数出现次数:守卫与 `.map` 各一处,少一处就会在另一处崩(undefined.map)。 */
    const hits = src.match(/low_confidence_notes_plain\s*\?\?\s*l1\.low_confidence_notes/g);
    assert.equal(
      (hits ?? []).length, 2,
      `守卫与 .map 两处都要写成 \`plain ?? 审计版\`,实际 ${(hits ?? []).length} 处`,
    );
  });
});

describe('类型定义', () => {
  test('登记了 low_confidence_notes_plain', () => {
    const types = codeOf(readFileSync(TYPES, 'utf8'));
    assert.ok(
      /low_confidence_notes_plain\?:/.test(types),
      '`assessment.ts` 没登记 `low_confidence_notes_plain`',
    );
  });
});
