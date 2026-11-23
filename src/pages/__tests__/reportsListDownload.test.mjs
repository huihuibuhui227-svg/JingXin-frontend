/**
 * 「历史报告」列表必须自带下载入口 —— 这是使用者卡住的那一处。
 *
 * ## 为什么立这颗钉子
 *
 * 使用者原话:「我在前端找不到下载报告的按钮」。他走的是「历史报告」列表页。
 * 而那个页面的行操作只有「查看」,它 `window.open(row.url, '_blank')` 打开的是
 * **后端静态 HTML**(`/output/<name>.html`)—— 那一页里没有任何 JS 应用,
 * 所以**不可能**有「下载报告」按钮(那个按钮只存在于 `ReportPage`)。
 * 换句话说:从列表进去,前端确实无处可点 —— 这是真卡点,不是没看见。
 *
 * ## 这个文件守什么(任何一条回退,使用者会再次找不到入口)
 *
 * 1. 每一行都有**行内的下载动作**,且是原生 `<a download>`:
 *    `href={row.url}`(后端 `getFiles('reports')` 发的相对路径 `/output/<name>`)
 *    + `download={row.name}`(文件名与列表里印的那一份一致)。
 * 2. 下载**不许**走 `window.open` / `target="_blank"`:
 *    那正是"点下载 → 新开一个标签看裸 HTML、什么都没有发生"的原样回退。
 * 3. 下载**不许**写死后端地址(`http://127.0.0.1:5000/output/...`):
 *    开发期靠 vite 代理、生产期与页面同源,写死地址在别人的机器上是空的。
 * 4. `ReportPage` 在 `describedId` 为空(典型 `/report/latest`)时,
 *    除了按钮禁用,还要在页面上给出**去哪下载**的那句话(不用 `alert`)。
 *
 * ## 为什么是"读源码 + 断言形态",不是 import 组件
 *
 * `npm test` 跑的是 `node --test src/**\/__tests__/*.test.mjs`,Node 的类型剥离
 * 不处理 JSX,而且环境里没有浏览器(不装 / 不跑 jsdom)。本仓既有的组件级测试
 * (`downloadButtonHasTarget.test.mjs` / `coverageSegments.test.mjs`)用的是同一个办法。
 * 真存盘这件事只能在浏览器里验 —— 见交付说明里的 3 步手工清单。
 *
 * 怎么跑:`npm test`
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const LIST = resolve(HERE, '../ReportsList.tsx');
const PAGE = resolve(HERE, '../ReportPage.tsx');

/** 剥掉注释后的**会执行的代码**。
 *
 * 不剥的话,断言会匹配到说明注释里引用的旧写法(`window.open` / 绝对地址都
 * 出现在本文件的注释里)—— 本仓已经栽过一次。
 */
const codeOf = (text) =>
  text
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '') // JSX 注释
    .replace(/\/\*[\s\S]*?\*\//g, '') // 普通块注释
    .split('\n')
    .map((l) => l.replace(/\/\/.*$/, ''))
    .join('\n');

const listSrc = readFileSync(LIST, 'utf8');
const pageSrc = readFileSync(PAGE, 'utf8');
const listCode = codeOf(listSrc);
const pageCode = codeOf(pageSrc);

/** 「下载」那一个链接的**开标签**。 */
const downloadAnchor = (() => {
  const tags = listCode.match(/<a\b[^>]*>/g) ?? [];
  return tags.find((t) => t.includes('download={row.name}')) ?? null;
})();

describe('历史报告列表:每一行都有下载动作', () => {
  test('行内有 <a download>,href 是列表给的相对地址 row.url', () => {
    assert.ok(downloadAnchor, '列表里没有带 download={row.name} 的 <a> —— 使用者又会找不到下载');
    assert.ok(downloadAnchor.includes('href={row.url}'),
      `下载链接的 href 不是 row.url:${downloadAnchor}`);
    assert.match(listCode, /url:\s*item\.url/,
      'row.url 必须来自 GET /api/files/reports 的载荷,不能自己拼路径');
  });

  test('文件名用 row.name(与列表里印的那一份同名)', () => {
    assert.match(listCode, /download=\{row\.name\}/,
      '没有 download={row.name} —— 后端 /output 回的 Content-Disposition 剥掉了中文名,存下来的文件名会是错的');
  });

  test('下载不走 window.open,也不开新标签', () => {
    assert.ok(!/window\.open/.test(downloadAnchor),
      '下载链接里出现了 window.open —— 那就是"再开一个裸 HTML 标签"的原样回退');
    assert.ok(!/\btarget=/.test(downloadAnchor),
      '下载链接带了 target —— download 一旦被忽略就会新开标签,使用者看到的是页面而不是文件');

    // 剩下的 window.open(「查看」/报告标题)必须只做"看",不许承载下载。
    const calls = listCode.match(/window\.open\([^)]*\)/g) ?? [];
    assert.ok(calls.length > 0, '「查看」还在用 window.open —— 断言失效说明取调用点的方式要更新');
    for (const call of calls) {
      assert.ok(!/download|\.name/.test(call),
        `window.open 被拿来承载下载了:${call}`);
    }
  });

  test('下载地址不许写死后端主机(开发期靠 vite 代理,生产期同源)', () => {
    assert.doesNotMatch(listCode, /https?:\/\//,
      'ReportsList 里出现了写死的 http(s) 地址 —— 换台机器点下载就是空的');
    assert.doesNotMatch(listCode, /\/output\//,
      '前端自己拼了 /output/ 路径 —— 该用载荷里的 row.url(后端改路径时不会跟着错)');
  });

  test('「查看」保留(打开静态 HTML),但下载与它是两个动作', () => {
    assert.match(listCode, /查看/,
      '「查看」不见了 —— 那一份静态 HTML 仍然需要能直接读');
    assert.match(listCode, /下载/,
      '列表里没有「下载」这两个字 —— 使用者按字找,找不到就等于没有');
  });
});

describe('报告页:没有会话号时给出"去哪下载"那句话', () => {
  test('!describedId 时渲染 Alert(不是 alert),且内容指向历史报告与 /report/<会话号>', () => {
    const i = pageCode.indexOf('!describedId &&');
    assert.ok(i >= 0, 'ReportPage 没有 !describedId 的兜底分支 —— `/report/latest` 只有一个灰按钮');
    const block = pageCode.slice(i, i + 900);
    assert.match(block, /<Alert/, '兜底指引必须就地渲染在页面上(Alert),不是一闪而过的 message');
    assert.match(block, /历史报告/,
      '兜底指引没提「历史报告」—— 使用者不知道该从哪个页面下载');
    assert.match(block, /\/report\/<会话号>/,
      '兜底指引没给出可直接访问的 /report/<会话号> 形态');
    assert.match(block, /下载/, '兜底指引没提「下载」这个动作');
  });

  test('不用 window.alert 兜底', () => {
    assert.doesNotMatch(pageCode, /\balert\(/,
      'ReportPage 里出现了 alert( —— 弹窗不算"在页面上说清楚"');
  });

  test('按钮本身仍然是禁用 + 说明,不是"能点、点了没反应"', () => {
    assert.match(pageCode, /disabledReason=\{describedId \? undefined : /,
      'describedId 为空时没给 disabledReason —— 灰按钮不会解释自己为什么灰');
  });
});
