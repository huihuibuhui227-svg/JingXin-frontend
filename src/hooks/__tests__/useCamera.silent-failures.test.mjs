/**
 * 采集层的**静默失败**守卫(2026-10-25 凌晨,子智能体审计后)。
 *
 * ## 为什么这个文件存在
 *
 * `useCamera.startNativeRecorder` 有四条失败路径只打 `console.error` 就 `return`
 * (没有 `onDegraded`),后果链是:
 *
 *   recorder 起不来 ⟹ `mediaRecorderRef` 保持 null ⟹ `stopCapture` 不进 stop 分支
 *   ⟹ `onstop` 不跑 ⟹ `onVideoReady` 永不调用 ⟹ 界面上**没有任何降级信号**
 *
 * 而页面照常开保存门禁;点「留存本场」走 `useSessionRecording` 的
 * `if (p) … else { setSavedInfo(...); message.success('本场已确认留存') }`
 * —— 用户看到**绿色的成功提示**,盘上却没有 `camera.webm`。
 *
 * 这正是本仓反复栽的形态:「弹窗说成功、盘上没东西」。
 *
 * ## 这个文件守什么
 *
 * ① `startNativeRecorder` 的每条早退路径都必须走 `onDegraded`;
 * ② 容器按**实际轨道**选 —— audio-only 的流没有视频轨,却硬塞 vp8。
 *    实测 Chrome 155 会**宽容**地接受并撒谎(`recorder.mimeType` 报 vp8,
 *    实际分片是 opus),所以「抛不抛」取决于浏览器;但**修法不取决于结论**:
 *    按轨选 mime 之后,两种浏览器行为都不会再落进静默分支。
 *
 * ## 怎么跑
 *
 *     node --test src/hooks/__tests__/
 *
 * 这是仓库里第一份前端测试(原先 `package.json` 没有 test 脚本,也没有跑测器)。
 * 用的是 Node 自带的 `node:test` + 一个最小的 React 替身,所以**不需要新增依赖**。
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, '../../hooks/useCamera.ts');

function source() {
  return readFileSync(SRC, 'utf8');
}

/** 取 `startNativeRecorder` 这个 useCallback 的函数体源码。 */
function recorderBody() {
  const src = source();
  const start = src.indexOf('const startNativeRecorder = useCallback(');
  assert.ok(start > 0, '找不到 startNativeRecorder —— 函数被改名了?本测试要跟着改');
  // 到下一个顶层 `const ... = useCallback(` 或 `startNativeRecorderRef.current =` 为止
  const end = src.indexOf('startNativeRecorderRef.current = startNativeRecorder', start);
  assert.ok(end > start, '找不到 startNativeRecorder 的结尾');
  return src.slice(start, end);
}

describe('startNativeRecorder 的早退路径', () => {
  test('每条 console.error 早退之前都报了 onDegraded', () => {
    const body = recorderBody();
    // 逐个找「console.error(...) 之后紧跟着 return」的早退点,
    // 断言**这一段里**出现过 onDegraded。
    // ⚠️ 第一版写错了:它比较的是"整个函数里最后一次 onDegraded 与最后一次
    //    console.error 的位置",于是每条 console.error 自己的位置更靠后,
    //    判据恒为假 —— 测试红了,但红的是测试不是代码。
    const re = /console\.error\(/g;
    let checked = 0;
    for (const m of body.matchAll(re)) {
      const after = body.slice(m.index);
      const ret = after.indexOf('return;');
      assert.ok(ret > 0, `console.error 之后没有 return?源码变了,先修测试:\n${after.slice(0, 160)}`);
      const segment = after.slice(0, ret + 'return;'.length);
      assert.match(
        segment,
        /onDegradedRef\.current\?\./,
        `有一条早退只打 console.error、没报 onDegraded(用户看不到任何降级信号):\n${segment}`,
      );
      checked++;
    }
    assert.ok(checked > 0, '一条早退路径都没找到 —— 正则过时了,先修测试');
  });

  test('「没有 mediaStream」这条早退确实报了降级', () => {
    const body = recorderBody();
    const i = body.indexOf('没有 mediaStream');
    assert.ok(i > 0, '这条早退被删了?');
    const window = body.slice(Math.max(0, i - 400), i + 400);
    assert.match(
      window,
      /onDegradedRef\.current\?\./,
      '「没有 mediaStream」这条只打 console.error —— 本场没有 camera.webm 而用户不知道',
    );
  });
});

describe('原生录像的容器按实际轨道选', () => {
  test('有视频轨用 video/webm;codecs=vp8,opus', () => {
    // 容器常量在模块级(不在 startNativeRecorder 体内),所以扫全文件。
    const src = source();
    assert.match(src, /video\/webm;codecs=vp8,opus/, '有视频轨时的容器串不见了');
  });

  test('audio-only 时不许硬塞 vp8 —— 改用纯音频容器', () => {
    const src = source();
    assert.match(
      src,
      /audio\/webm;codecs=opus/,
      'audio-only 的流仍然被硬塞 video/webm;codecs=vp8,opus。\n' +
        '实测 Chrome 会宽容接受并撒谎(recorder.mimeType 报 vp8、实际是 opus),' +
        '但换一个浏览器抛 NotSupportedError 就落进静默分支 —— 本场一音一画都没有。',
    );
    // 选择必须**看轨道**,不是看一个写死的常量
    assert.match(src, /getVideoTracks\(\)\.length/, '容器没有按「有没有视频轨」来选');
    // ⚠️ 而且**这个选择必须真的被用上**。第一版只断言"文件里有
    //    `getVideoTracks().length`"和"`new MediaRecorder(..., mimeType: mime)`" ——
    //    把 `const mime = pickRecorderMime(mediaStream)` 改回 `const mime = VIDEO_MIME`
    //    之后**仍然全绿**(实测),因为那两串都还在。这就是假守卫。
    const body = recorderBody();
    assert.match(
      body,
      /new MediaRecorder\(mediaStream,\s*\{\s*mimeType:\s*mime\b/,
      '仍然拿写死的常量去开录',
    );
    assert.match(
      body,
      /const mime\s*=\s*pickRecorderMime\(\s*mediaStream\s*\)/,
      '容器不是由 `pickRecorderMime(mediaStream)` 决定的 —— 按轨选那一层没接上',
    );
  });
});

describe('摄像头轨中途死亡', () => {
  test('给视频轨挂了 ended/mute 监听', () => {
    const src = source();
    // 监听挂在 `beginCapture` 里(帧循环与它同生共死),不是 startCapture。
    const start = src.indexOf('const beginCapture = useCallback(');
    const end = src.indexOf('const stopCapture = useCallback(', start);
    assert.ok(start > 0 && end > start, '找不到 beginCapture —— 函数被改名了?');
    const body = src.slice(start, end);
    assert.match(
      body,
      /addEventListener\(\s*['"]ended['"]/,
      '没有给视频轨挂 ended —— 摄像头被拔/被抢之后画面冻住',
    );
    assert.match(
      body,
      /addEventListener\(\s*['"]mute['"]/,
      '没有给视频轨挂 mute —— 被静音/被别的应用占用时抓不到',
    );
  });

  test('还有逐帧比对兜底 —— 因为 track.stop() 不触发 ended', () => {
    const src = source();
    const start = src.indexOf('const beginCapture = useCallback(');
    const end = src.indexOf('const stopCapture = useCallback(', start);
    const body = src.slice(start, end);
    // 实测:脚本停轨之后 readyState 恒为 4、每帧像素完全相同,事件一条都不来。
    assert.match(
      body,
      /getImageData/,
      '没有逐帧比对 —— track.stop() 不触发 ended,只挂事件抓不住"画面冻住"',
    );
    assert.match(body, /frameKey/, '没有帧指纹,逐帧比对不成立');
  });
});
