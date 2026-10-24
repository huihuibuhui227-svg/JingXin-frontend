/**
 * 帧分析连续失败必须**说出来**,不能只 `console.warn`。
 *
 * ## 为什么这个文件存在
 *
 * `AssessmentPage` / `RealtimeAnalysis` 的 `onFrame` 里,面部与手势各有一句
 * `.catch(err => console.warn('⚠️ 面部分析失败:', err.message))`。采集循环照旧
 * 每秒发帧、`Promise.allSettled` 照旧 resolved,于是:
 *
 *   后端 8000/8002 挂了 ⟹ 每一帧都失败 ⟹ **界面显示的是上一帧成功时的指标**
 *   ⟹ 用户看到一张"正常在跑"的实时面板 ⟹ 这一场 face/gesture 日志一行没有。
 *
 * 这是本仓反复栽的形态:失败被降级成一行控制台日志,而**界面在替它撒谎**。
 * `capture_health` 也判不出来 —— 它看的是"帧到了没有",而这里帧**根本没发出去**。
 *
 * ## 这个文件守什么
 *
 * ① `analysisHealth` 的判据:连续失败到阈值才报,**只报一次**;
 * ② 任何一次成功都清零(否则一场里偶发失败会被累加成"整场没数据");
 * ③ 两个页面**都**接上了它 —— 改了一个忘了另一个是本仓的老毛病。
 *
 * 怎么跑:`npm test`(Node 24 原生剥类型,直接 import `.ts`,不需要新依赖)
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { createAnalysisHealth } from '../../utils/analysisHealth.ts';

const HERE = dirname(fileURLToPath(import.meta.url));

describe('analysisHealth 的判据', () => {
  test('连续失败到阈值才报', () => {
    const said = [];
    const h = createAnalysisHealth((r) => said.push(r), 3);
    h.fail('boom');
    h.fail('boom');
    assert.deepEqual(said, [], '没到阈值就报了 —— 偶发失败不该打扰用户');
    h.fail('boom');
    assert.equal(said.length, 1, '到了阈值却没报');
    assert.match(said[0], /3/, '报的理由里要说清连续几次');
  });

  test('只报一次 —— 不刷屏', () => {
    const said = [];
    const h = createAnalysisHealth((r) => said.push(r), 2);
    for (let i = 0; i < 50; i++) h.fail('boom');
    assert.equal(said.length, 1, `报 ${said.length} 次 —— 降级横幅会被刷屏`);
  });

  test('一次成功就清零', () => {
    const said = [];
    const h = createAnalysisHealth((r) => said.push(r), 3);
    h.fail('a'); h.fail('a');
    h.ok();
    h.fail('a'); h.fail('a');
    assert.deepEqual(said, [], '中间成功过却仍累加 —— 一场里偶发失败会被算成"整场没数据"');
    h.fail('a');
    assert.equal(said.length, 1, '清零之后重新数到阈值应该再报一次');
  });

  test('恢复之后可以再报 —— 不是一辈子只报一次', () => {
    const said = [];
    const h = createAnalysisHealth((r) => said.push(r), 2);
    h.fail('a'); h.fail('a');
    h.ok();
    h.fail('a'); h.fail('a');
    assert.equal(said.length, 2, '恢复后再次失败没报 —— 中途好了又坏,用户不会知道');
  });

  test('默认阈值是 5 —— 不传第三个参数时也在 5 次后报', () => {
    // ⚠️ 这条补的原因是变异测试抓出来的:上面三条全都**显式传了阈值**,
    //    于是把默认值改成 9999 之后 16 条**全绿**。默认值才是生产里真正用的那个。
    const said = [];
    const h = createAnalysisHealth((r) => said.push(r));
    for (let i = 0; i < 4; i++) h.fail('a');
    assert.deepEqual(said, [], '默认阈值不是 5(4 次就报了)');
    h.fail('a');
    assert.equal(said.length, 1, '默认阈值不是 5(5 次没报)');
  });
});

describe('两个页面都接上了', () => {
  const PAGES = [
    ['components/assessment/AssessmentPage.tsx',
     resolve(HERE, '../../components/assessment/AssessmentPage.tsx')],
    ['pages/RealtimeAnalysis.tsx',
     resolve(HERE, '../../pages/RealtimeAnalysis.tsx')],
  ];

  for (const [name, p] of PAGES) {
    test(`${name} 把连续失败报成降级`, () => {
      const src = readFileSync(p, 'utf8');
      assert.match(src, /createAnalysisHealth/, '没有接 analysisHealth —— 连续失败仍然只进控制台');
      assert.match(src, /addDegraded/, '接了却没往 addDegraded 报 —— 用户看不到');
      // ⚠️ 光有 `createAnalysisHealth(` 和 `addDegraded` 两串还不够 —— 变异实测:
      //    把两处 `.fail(...)` 删掉、把对象换成空壳,上面两条**照旧绿**。
      //    判据必须落在"**失败真的被数了**"上:每个 `.catch` 里都得有一次 fail。
      const catches = [...src.matchAll(/\.catch\(err => \{[\s\S]*?\}\)/g)].map((m) => m[0]);
      const analysisCatches = catches.filter((c) => /分析失败/.test(c));
      assert.ok(analysisCatches.length >= 2,
        `只找到 ${analysisCatches.length} 处「分析失败」的 catch(面部+手势应有 2 处)`);
      for (const c of analysisCatches) {
        assert.match(c, /analysisHealthRef\.current\.fail\(/,
          `这一处分析失败没有数进去 —— 后端挂了界面照样显示上一帧的值:\n${c}`);
      }
    });
  }
});
