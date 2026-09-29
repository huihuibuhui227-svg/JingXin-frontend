/**
 * 无障碍（a11y）实测。
 *
 * 用 Playwright 自带的浏览器加载页面，注入 axe-core 跑真实规则，
 * 按严重级别汇总违规项。不依赖 webdriver，不需要另装 Chrome。
 *
 * 用法：
 *   npm i -D axe-core          # 只需这一个依赖
 *   node scripts/a11y.mjs                          # 默认测全部路由
 *   node scripts/a11y.mjs http://127.0.0.1:5173/   # 只测指定地址
 *
 * 退出码：有 critical/serious 违规时为 1，便于接进 CI。
 */
import { chromium } from 'playwright';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const AXE_PATH = require.resolve('axe-core/axe.min.js');

const BASE = process.env.JX_BASE || 'http://127.0.0.1:5173';

/** 默认覆盖全部路由 —— 只测首页会漏掉数据密集的表格页。 */
const ROUTES = process.argv[2]
  ? [process.argv[2]]
  : [
      '/',
      '/interview',
      '/research',
      '/analysis',
      '/reports',
      '/recordings',
      '/report/latest'
    ];

// axe 的 impact 分级：critical > serious > moderate > minor
const ORDER = ['critical', 'serious', 'moderate', 'minor'];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });

let totalBlocking = 0;

for (const route of ROUTES) {
  const url = route.startsWith('http') ? route : BASE + route;
  const page = await ctx.newPage();
  let failed = null;

  page.on('pageerror', (e) => {
    failed = failed || e.message;
  });

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    // 让懒加载路由与 antd 的入场动画落定
    await page.waitForTimeout(1200);

    await page.addScriptTag({ path: AXE_PATH });
    const result = await page.evaluate(async () => {
      // @ts-expect-error axe 由上面的 script 注入到 window
      return await window.axe.run(document, {
        resultTypes: ['violations'],
        // 图表是 canvas/SVG，axe 判不了内部，别让它刷屏
        rules: { 'color-contrast': { enabled: true } }
      });
    });

    const byImpact = {};
    for (const v of result.violations) {
      const k = v.impact || 'unknown';
      (byImpact[k] ||= []).push(v);
    }

    const counts = ORDER.filter((k) => byImpact[k]).map((k) => `${k}:${byImpact[k].length}`);
    const blocking = (byImpact.critical?.length || 0) + (byImpact.serious?.length || 0);
    totalBlocking += blocking;

    console.log(`\n${blocking > 0 ? '✗' : '✓'} ${route}  ${counts.join('  ') || '无违规'}`);
    if (failed) console.log(`   ⚠ 页面报错: ${failed}`);

    for (const impact of ORDER) {
      for (const v of byImpact[impact] || []) {
        console.log(`   [${impact}] ${v.id} — ${v.help}`);
        console.log(`       影响 ${v.nodes.length} 处 · ${v.helpUrl}`);
        // 只打印前两个节点，避免刷屏；要看全部就把下面这行去掉
        for (const n of v.nodes.slice(0, 2)) {
          const sel = n.target?.[0] || '?';
          console.log(`       · ${typeof sel === 'string' ? sel : JSON.stringify(sel)}`);
        }
        if (v.nodes.length > 2) console.log(`       · …另有 ${v.nodes.length - 2} 处`);
      }
    }
  } catch (e) {
    console.log(`\n✗ ${route}  加载失败: ${e.message}`);
  } finally {
    await page.close();
  }
}

await browser.close();

console.log(
  `\n${'─'.repeat(60)}\n` +
    (totalBlocking > 0
      ? `✗ 共 ${totalBlocking} 项 critical/serious 违规 —— 需要修`
      : `✓ 没有 critical/serious 违规`)
);
process.exit(totalBlocking > 0 ? 1 : 0);
