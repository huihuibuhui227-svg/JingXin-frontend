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

describe('startCamera 的返回值', () => {
  /** 取 `startCamera` 这个 useCallback 的函数体源码。 */
  function cameraBody() {
    const src = source();
    const start = src.indexOf('const startCamera = useCallback(');
    assert.ok(start > 0, '找不到 startCamera —— 函数被改名了?本测试要跟着改');
    const end = src.indexOf('const startCapture = useCallback(', start);
    assert.ok(end > start, '找不到 startCamera 的结尾');
    return src.slice(start, end);
  }

  test('「videoRef.current 为 null」必须返回 false,不能返回 true', () => {
    // ⚠️ 这条是本文件里最贵的一条:两个调用方(`AssessmentPage`、`RealtimeAnalysis`)
    //    都把 `false` 当成「整场作废」并弹一条不会自动消失的错误。
    //    而这里原先打一句 `console.error('❌ videoRef.current 为 null')` 之后
    //    **`return true`** —— 调用方以为摄像头起来了,于是往下走 `startCapture()`,
    //    而 `startCapture` 在同一个 null 上只 `console.warn` 就 return。
    //    结果:没有帧、没有原生录像,界面一切正常。正是那两个调用方被修好要防的事。
    const body = cameraBody();
    const i = body.indexOf('videoRef.current 为 null');
    assert.ok(i > 0, '「videoRef.current 为 null」这个分支被删/改写了?本测试要跟着改');
    // 取这个分支到它所在 if 的收尾(下一个 `return true;` 之前的那一段)
    const after = body.slice(i);
    const ret = after.indexOf('return');
    assert.ok(ret > 0, '这个分支后面没有 return?源码变了,先修测试');
    const segment = after.slice(0, ret + 40);
    assert.doesNotMatch(
      segment,
      /return true/,
      'videoRef 为 null 时仍返回 true —— 调用方会以为摄像头起来了,实际一帧都采不到',
    );
    assert.match(
      segment,
      /return false/,
      'videoRef 为 null 时没有返回 false —— 那正是「整场作废」的信号',
    );
    assert.match(
      segment,
      /onDegradedRef\.current\?\./,
      'videoRef 为 null 时没报降级 —— 用户看不到任何提示',
    );
  });
});

describe('useAudioRecorder 收尾不丢最后一段', () => {
  const AUDIO_SRC = resolve(HERE, '../../hooks/useAudioRecorder.ts');

  function audioSource() {
    return readFileSync(AUDIO_SRC, 'utf8');
  }

  function stopBody() {
    const src = audioSource();
    const start = src.indexOf('const stopRecording = useCallback(');
    assert.ok(start > 0, '找不到 stopRecording —— 函数被改名了?本测试要跟着改');
    const end = src.indexOf('}, []);', start);
    assert.ok(end > start, '找不到 stopRecording 的结尾');
    return src.slice(start, end);
  }

  test('stop() 之后不许同步拼 blob —— 最后一块要等 stop 事件', () => {
    // ⚠️ `MediaRecorder.stop()` 是**异步**的:规范里它先排一个最终的
    //    `dataavailable`,再发 `stop`。而原先的写法是
    //        rec.stop(); rec.stream.getTracks().forEach(t => t.stop());
    //        const blob = new Blob(chunksRef.current, ...); chunksRef.current = [];
    //    —— 三行全是同步的,于是**最终那一块永远赶不上**这次拼接。
    //    实测(2026-10-25):同样 2.82 秒的录音,走 `stop()` 收尾只拿到
    //    30904 字节 / 2.34 秒,少掉的那 0.48 秒正是尾巴。
    //    尾巴丢了不会报错:ASR 照样识别、界面照样报成功,只是最后一个字没了。
    const body = stopBody();
    const listener = body.search(/addEventListener\(\s*['"]stop['"]|onstop\s*=/);
    assert.ok(listener > 0, 'stopRecording 没有等 `stop` 事件 —— 最后一块 dataavailable 永远赶不上这次拼接');
    assert.ok(body.indexOf('.stop()') > 0, '找不到 rec.stop()');

    // 拼接与清空必须在 **stop 事件的回调体里**。取回调体的做法:从监听器注册处
    // 到它自己的收尾 `});` 为止 —— 而不是"`rec.stop()` 之后",因为监听器本来就
    // 注册在 `rec.stop()` **之前**(先挂后调,否则事件可能已经发过去了)。
    // ⚠️ 第一版写的是「`rec.stop()` 之后找监听器」,于是改对了实现仍然红 ——
    //    红的是测试,不是代码。
    const tail = body.slice(listener);
    // ⚠️ 别用第一个 `});` 当回调的收尾:`new Blob(chunksRef.current, { type: 'audio/webm' });`
    //    里就有一个 `});`。用 `resolve(` 当收尾标记 —— 它一定在回调体的末尾。
    const close = tail.indexOf('resolve(');
    assert.ok(close > 0, '找不到 stop 回调的 resolve');
    const callback = tail.slice(0, close);
    assert.match(callback, /new Blob\(/, 'blob 不是在 stop 事件回调里拼的');
    assert.match(callback, /chunksRef\.current\s*=\s*\[\]/, 'chunks 不是在 stop 事件回调里清空的');
  });

  test('stopRecording 返回 Promise(调用方要 await)', () => {
    const body = stopBody();
    assert.match(body, /Promise</, 'stopRecording 仍然同步返回 Blob —— 调用方拿不到最后一块');
  });

  test('调用方确实 await 了它', () => {
    // 改了签名不改调用方 ⟹ 拿到的是 Promise 对象,`if (!audioBlob)` 恒假,
    // 于是把 `[object Promise]` 当成音频发出去。这比丢尾巴更坏。
    const src = readFileSync(
      resolve(HERE, '../../components/assessment/AnswerInput.tsx'), 'utf8');
    assert.match(
      src,
      /await\s+onStopRecording\(\)/,
      'AnswerInput 没有 await onStopRecording() —— 它拿到的是 Promise,不是 Blob',
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
