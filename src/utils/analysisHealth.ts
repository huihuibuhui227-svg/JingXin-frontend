/**
 * 帧分析连续失败的判据。
 *
 * 为什么需要它:两个页面的 `onFrame` 里,面部与手势各有一句
 * `.catch(err => console.warn(...))`。后端挂了 ⟹ 每一帧都失败 ⟹
 * **界面显示的是上一帧成功时的指标**,看起来一切正常,而这一场 face/gesture
 * 日志一行没有。`capture_health` 判不出来:它看"帧到了没有",这里帧根本没发出去。
 *
 * 判据刻意做成**有状态的小对象**而不是散在组件里的计数器:
 * ① 连续到阈值才报(偶发失败不该打扰用户);
 * ② 只报一次(否则降级横幅被刷屏);
 * ③ 任何一次成功都清零(否则一场里的偶发失败会累加成"整场没数据");
 * ④ 恢复之后再次失败**可以再报**(不是一辈子只报一次)。
 *
 * 钉子:`src/hooks/__tests__/analysisHealth.test.mjs`。
 */

export interface AnalysisHealth {
  /** 这一帧的分析失败了。 */
  fail(reason: string): void;
  /** 这一帧的分析成功了 —— 清零。 */
  ok(): void;
}

/**
 * @param report 达到阈值时调一次(接到 `addDegraded` 上)
 * @param threshold 连续失败多少次才报。默认 5:5 帧 ≈ 1 秒(两个页面都按
 *   `SEND_EVERY_NTH_FRAME` 节流后再发),短到能在一场里发现,长到不会被
 *   一次网络抖动误报。
 */
export function createAnalysisHealth(
  report: (reason: string) => void,
  threshold = 5,
): AnalysisHealth {
  let consecutive = 0;
  let reported = false;

  return {
    fail(reason: string) {
      consecutive += 1;
      if (consecutive >= threshold && !reported) {
        reported = true;
        report(
          `连续 ${consecutive} 帧的分析全部失败(${reason})—— ` +
          `面板上显示的是最后一次成功时的值,这一场的面部/手势日志可能一行都没有`,
        );
      }
    },
    ok() {
      consecutive = 0;
      // ⚠️ `reported` 也清零。只清计数的话,中途好了又坏就再也不报了 ——
      //    而"中途好了又坏"恰恰是最需要用户知道的一种。
      reported = false;
    },
  };
}
