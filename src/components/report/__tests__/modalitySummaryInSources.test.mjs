/**
 * 报告页的「本场会话」那块,不许与同一份载荷里的指标明细**互相打架**。
 *
 * ## 实测缺陷(2026-10-25,服务器上真跑的一场 `20260928_180131_8102`)
 *
 * 后端 HTML 报告头写着「语音（面试） · 未读到数据（…若本场确实答过题,那才是文件损坏）」,
 * 而同一份载荷里 V 族 12 条有 10 条有值 —— 报告页的 `sources` 那块有同样的问题:
 * 它只读后端给的三态(`loaded` / `unreadable` / `missing`),而那三态**只描述日志文件**。
 *
 * 语音还有第二个数据源:整场录音逐帧重算(`voice_series`),不经日志。
 *
 * ## 修法(与后端同一套分层)
 *
 * 载荷里 `l1.modality_summary` 给出每个模态**到底算出了几条**
 * (`{模态: {n_total, n_measured, source_note}}`),前端照抄。
 * 前端不许自己数 —— 它拿不到族与模态的归属。
 *
 * ## 这个文件守什么
 *
 * 1. 组件读 `modality_summary`;
 * 2. 有值时那条 `unreadable`/`missing` 换成「算出了 N / M 条」;
 * 3. 类型定义里登记了 `modality_summary`。
 *
 * 怎么跑:`npm test`
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = resolve(HERE, '../../../pages/ReportPage.tsx');
const TYPES = resolve(HERE, '../../../types/assessment.ts');

/** 去掉注释再断言 —— 注释里会提到字段名,直接扫源码会把注释当成渲染。 */
const codeOf = (text) =>
  text
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((l) => l.replace(/\/\/.*$/, ''))
    .join('\n');

const page = codeOf(readFileSync(PAGE, 'utf8'));

describe('报告页的「本场会话」', () => {
  test('读载荷给的每个模态算出了几条', () => {
    assert.ok(
      page.includes('modality_summary'),
      '组件没读 `modality_summary` —— 日志为空时它会印「未读到数据」,而语音其实算出了值',
    );
  });

  test('有值时不再说「未读到数据」', () => {
    /* 判据必须是"这个模态算出了几条",不是日志三态 ——
       三态说日志,条数说指标,两件事。

       ⚠️ 断言要**锚到表达式**上,不能只查 `n_measured` 这个词:
       2026-10-25 实测,把整个条件换成 `if (false)` 之后测试照样绿,
       因为字段名在别处还出现(改名成 `modality_summaryX` 同理 ——
       子串匹配让改名也过)。 */
    assert.match(
      page,
      /got\s*&&\s*got\.n_measured\s*>\s*0/,
      '没有「算出了几条 > 0」这个判据 —— 日志为空时仍会印「未读到数据」',
    );
    assert.match(
      page,
      /v\.status\s*!==\s*'loaded'\s*&&/,
      '判据没挂在"日志不是 loaded"上 —— 有日志时不该走这条分支',
    );
  });
});

describe('类型定义', () => {
  test('登记了 modality_summary', () => {
    const types = codeOf(readFileSync(TYPES, 'utf8'));
    /* ⚠️ 断言带 `?:` —— 只查 `modality_summary` 的话,改名成
       `modality_summaryX` 也能过(子串包含),实测踩到。 */
    assert.ok(
      /modality_summary\?:/.test(types),
      '`assessment.ts` 没登记 `modality_summary` —— 组件读的是 any,改后端不会有人发现',
    );
  });
});
