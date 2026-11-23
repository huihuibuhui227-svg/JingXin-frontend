/**
 * 报告页的「仪器来源」那块 —— 逐条标签 + 汇总区,数字**全部来自载荷**。
 *
 * ## 为什么这块卡片必须存在
 *
 * `report_frontend/instrument_provenance.py` 早就把"每条指标出自哪套仪器"算出来了,
 * 而接入前全仓报告层 `grep -niE "instrument|仪器"` 在 `l1_report.py` /
 * `report_generator.py` / 前端 **零命中** —— 字段躺在载荷里,页面上一个字都没有。
 * 使用者拿报告去讲"双仪器",报告本身没提,那就是一句无法核对的声明。
 *
 * ## 这个文件守什么(四条,每条都对应一次会静默失败的形态)
 *
 * 1. `ReportPage` **真的挂上了**这块卡片(不挂 = 组件写好了但没人用);
 * 2. 页脚那句话读载荷的 `footer`,**前端不拼** —— 两处各拼一份,措辞早晚不一致;
 * 3. 汇总是**一枚一枚按载荷的 `order`** 排,不遍历 `counts` 的键(JS 的对象键序
 *    会让"两套面部仪器"的顺序随输入抖动,读者会把两者对调);
 * 4. 「未登记」是**缺口**:单独配色 + 虚线边框 + 单独的说明段。
 *    排成同款灰标签,它就会被当成第三套仪器读过去。
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
const COMPONENT = resolve(HERE, '../InstrumentProvenance.tsx');

/** 去掉注释再断言 —— 注释里会提到这些字段名,直接扫源码会把注释当成渲染。 */
const codeOf = (text) =>
  text
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((l) => l.replace(/\/\/.*$/, ''))
    .join('\n');

const page = codeOf(readFileSync(PAGE, 'utf8'));
const component = codeOf(readFileSync(COMPONENT, 'utf8'));

describe('报告页的「仪器来源」', () => {
  test('卡片真的挂在报告页上,而且拿到的是 l1 段', () => {
    assert.ok(
      page.includes('<InstrumentProvenance'),
      'ReportPage 没挂 `InstrumentProvenance` —— 组件写好了但没人用',
    );
    assert.ok(
      /<InstrumentProvenance\s+l1=\{/.test(page),
      '卡片没拿到 `l1`(那是仪器字段唯一的来处)',
    );
    assert.ok(
      page.includes("from '@/components/report/InstrumentProvenance'"),
      '没引用组件 —— 挂的是一个别的东西?',
    );
  });

  test('页脚那句读载荷的 footer,前端不自己拼', () => {
    assert.ok(
      component.includes('summary.footer'),
      '页脚没读载荷给的 `footer` —— 前端另拼一句,与 HTML 报告就会分叉',
    );
    // 手拼的痕迹:把「共 … 条指标 · 仪器来源」直接写进组件。
    assert.ok(
      !/共\s*\{?.*条指标 · 仪器来源/.test(component),
      '组件里出现了手拼的汇总句 —— 那句话只能由后端 `format_footer()` 出',
    );
  });

  test('汇总按载荷的 order 排,不按键遍历 counts', () => {
    assert.ok(
      component.includes('order.map'),
      '汇总没按 `order` 排 —— 键遍历会让两套面部仪器的顺序随输入抖动',
    );
    assert.ok(
      !/Object\.(keys|entries)\(\s*summary\.counts/.test(component),
      '汇总在遍历 `counts` 的键 —— 顺序会抖动',
    );
  });

  test('「未登记」单独立段,并且点出缺哪几列', () => {
    assert.ok(
      component.includes('unknown_note'),
      '没读载荷的 `unknown_note` —— 缺口没有解释就只是一句难懂的话',
    );
    assert.ok(
      component.includes('unmapped_columns'),
      '没点出缺哪几列 —— 只说"N 条未登记",读的人无从下手',
    );
    // 缺口样式:与其它四个仪器不同形(虚线框)。
    assert.ok(
      /unknown:\s*\{[\s\S]{0,220}?borderStyle:\s*'dashed'/.test(component),
      '「未登记」没用虚线框 —— 排成同款标签会被当成第三套仪器',
    );
  });

  test('单值 / 多值两种键只在一处判断(前端不许各判一次)', () => {
    assert.ok(
      component.includes('export const instrumentsOf'),
      '没有统一的读取函数 —— 组件里各判一次,早晚有一处漏掉多仪器',
    );
    assert.ok(
      /instrumentsOf\(r\)|instrumentsOf\(row\)/.test(component),
      '读取函数没有被渲染路径用上',
    );
  });

  test('标签来自载荷,前端不另立一张仪器→中文表', () => {
    assert.ok(
      component.includes('summary?.labels') || component.includes('summary.labels'),
      '没读载荷给的 `labels` —— 前端第二张标签表迟早与后端分叉',
    );
    // 只查"写成标签值"的形态:散文里提到「模型系数」是解释那句话,不是第二张标签表。
    assert.ok(
      !/['"](模型系数|几何代理|未登记)['"]/.test(component),
      '组件里写死了中文标签 —— 那两张表会分叉(标签只能由载荷给)',
    );
  });
});
