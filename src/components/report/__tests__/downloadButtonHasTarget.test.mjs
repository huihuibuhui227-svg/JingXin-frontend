/**
 * 「下载报告」按钮必须有去处 —— 没去处就得说出没去处。
 *
 * ## 为什么立这颗钉子
 *
 * `ReportPage` 里曾经是 `<DownloadButton />`:一个 prop 都没传。
 * 组件内部 `if (onDownload) … else if (reportUrl) …`,两条路都不成立 ⟹
 * 点下去**静默返回**:按钮亮着、没有任何反应、也没有一句话。
 * 现场演示时这就是"点下载,没反应"。
 *
 * 这颗钉子守四件事,**任何一条回退都会让"按钮又变成摆设"重新出现**:
 *
 * 1. `DownloadButton` 的禁用态必须挂 `Tooltip`,且默认那句话是「报告尚未生成」
 *    (而不是空字符串、也不是只有 `title` 属性 —— 那样鼠标停在灰按钮上没有解释);
 * 2. `ReportPage` 必须**传参**调用 `DownloadButton`(禁止裸 `<DownloadButton />`);
 * 3. `ReportPage` 传的参数里必须含 `onDownload` 或 `href` 之一 —— 二者之一是
 *    "这个按钮点下去会做什么"的唯一来源;
 * 4. 下载链路只许走**既有端点**:报错要说清是哪一步,所以它得查
 *    `/api/task/`(轮询既有任务)与 `api/files/reports`(既有列表),
 *    并且**没有**新造的导出接口(禁止出现 `/api/report/download` 这类路径)。
 *
 * 怎么跑:`npm test`
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const BUTTON = resolve(HERE, '../DownloadButton.tsx');
const PAGE = resolve(HERE, '../../../pages/ReportPage.tsx');

const buttonSrc = readFileSync(BUTTON, 'utf8');
const pageSrc = readFileSync(PAGE, 'utf8');

describe('下载报告按钮有去处', () => {
  test('禁用态用的是 Tooltip,不是 title 属性', () => {
    assert.match(buttonSrc, /<Tooltip/, '禁用态必须有 Tooltip —— 否则"为什么不能点"说不出来');
    assert.match(buttonSrc, /<span style=\{\{ display: 'inline-block'/,
      'Tooltip 要挂在包着 Button 的 span 上(禁用的 antd Button 不派发鼠标事件)');
  });

  test('不传 props 时默认理由是「报告尚未生成」', () => {
    assert.ok(buttonSrc.includes('报告尚未生成'),
      '默认禁用理由必须是「报告尚未生成」—— 这是使用者能看懂的那一句话');
  });

  test('没有 href 也没有 onDownload ⟹ 不派发任何动作', () => {
    assert.match(buttonSrc, /const hasAction = Boolean\(onDownload\) \|\| Boolean\(href\)/,
      '要有"有没有去处"的判据,而不是让 onClick 自己静默 return');
    assert.match(buttonSrc, /const disabled = !hasAction \|\| loading/,
      '没去处必须是禁用态(视觉上就能看出点不动)');
  });

  test('ReportPage 不能裸调 <DownloadButton />', () => {
    assert.ok(!/<DownloadButton\s*\/>/.test(pageSrc),
      'ReportPage 里出现了裸 <DownloadButton /> —— 那就是"点了没反应"的原样回退');
    const m = pageSrc.match(/<DownloadButton([\s\S]*?)\/>/);
    assert.ok(m, 'ReportPage 里找不到 <DownloadButton … />');
    const props = m[1];
    assert.ok(/onDownload=|href=/.test(props),
      'DownloadButton 必须拿到 onDownload 或 href —— 否则它没有可做的事');
  });

  test('只用既有端点:轮询 /api/task,列表走 api/files/reports', () => {
    assert.ok(pageSrc.includes('/api/task/'),
      '生成任务是后台线程跑的,必须轮询既有端点 /api/task/<task_id> 才知道跑完没有');
    assert.ok(pageSrc.includes("getFiles('reports')"),
      '报告文件名只有既有端点 GET /api/files/reports 会发(静态路由是 /output/<name>)');
    assert.ok(!/\/api\/report\/download|\/api\/reports\/\$\{|api\/export\/report/.test(pageSrc),
      '不要为了这个按钮新造后端接口 —— 既有静态路由 /output/<name> 就够');
  });

  test('失败要说清是哪一步', () => {
    assert.match(pageSrc, /catch \(err\)/, '下载链路必须有 catch,不能让 promise 悬着');
    assert.match(pageSrc, /setDownloadNote\(\{ kind: 'error'/,
      '失败时要在页面上留下那句话(而不是只 console.error)');
  });
});
