/**
 * 报告层**已停用**的实时量 —— 面板不许把它们当正常指标画给人看。
 *
 * ⚠️ **真源不在这个文件里**,在 `report_frontend/evidence_gate.py` 的 `QUARANTINE`
 * (那边按子串匹配、带解封条件)。这里只抄**显示层真正会用到**的那几条,理由逐字照抄,
 * 好让两边不一致时一眼看得出。
 *
 * 为什么不把整张名单抄过来:名单有 30+ 条、绝大多数前端根本不显示;抄全只会让
 * 漂移面变大(§4.10:「上游产出名 ≠ 下游列名」是这个项目踩过的坑)。
 * 什么时候该扩大:面板新增一个来自已停用列的显示项时。
 *
 * 什么时候该缩小:报告层解封某条时(`QUARANTINE` 里删掉它的那天,这里同步删)。
 */
export const STOPPED_METRICS: Record<string, string> = {
  focus_score: '3 个硬编码取值,99.7% 恒 0.3',
  tension_score: '伪合成,5 项里 2 项恒定',
  symmetry_score: '未除人脸尺度,近常量,取景代理',
  gaze_stability: '由被封停的 gaze_deviation 派生',
  hand_score: '可由同 block jitter 精确重构',
};

/** 该量是否在报告层已停用;是则给出理由(原样来自封停名单)。 */
export const stoppedReason = (key: string): string | undefined => STOPPED_METRICS[key];

/** 值是否可信:停用的量即使测到了,也不该按正常指标显示。 */
export const isStopped = (key: string): boolean => key in STOPPED_METRICS;
