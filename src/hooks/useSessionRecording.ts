import { useCallback, useRef, useState } from 'react';
import { message } from 'antd';
import { sessionApi, getSessionId } from '@/services/api';

/**
 * 「一场录制」的三件共用物:**本场标注**、**保存门禁**、**降级凭证**。
 *
 * 抽出来的理由:2026-09-28 那场 2.1 GB 的丢失事故之后,`/analysis` 攒出了一套
 * 纪律(标注先到、停止要确认、**没看到"已留存"就不算结束**),而 `/interview` 与
 * `/research` 还在用旧做法(答完最后一题 1.5 秒后自己跳走,录像存没存下没人知道)。
 * 三个页面需求一致 ⟹ 只留**一处定义** —— 本仓栽过的「两处各自算一遍、然后静默分叉」
 * 太多了(素材目录解析四处、M2.6 前端腿两处),不能再加一处。
 *
 * ── 三件事各自的"为什么" ────────────────────────────────────────────────
 *
 * ① **标注**:目录名现在是 `<序号>-<姓名>-<学号>-<院系>__<sid>`。没标注的一场,
 *    事后在盘上就是一个裸 sid —— 认不出是谁,等于白采。所以「取消 = 不开始」。
 *
 * ② **保存门禁**:录像整场**只活在浏览器内存里**,`MediaRecorder` 的分片攒到最后
 *    才拼成一个 blob。blob 到手 ≠ 存下了 —— 服务端没收下之前刷新/关页,
 *    整场**永久丢失**(9-28 就是这么丢的)。所以 `useCamera` 挂的那个
 *    `beforeunload` 拦截,要**一直留到留存确认**(它拿 `onVideoReady` 返回的
 *    promise 当信号 ⟹ 失败时那个 promise **故意继续悬着**)。
 *
 * ③ **降级凭证**:降级不是失败,但这一场留下的素材与"正常那一场"**不是一回事**,
 *    而事后只看文件看不出来。所以既要 toast(当场看见)也要**留在页面上的那条**
 *    (8 秒后溜走的提示不是凭证)。
 */

export type SaveState = 'idle' | 'saving' | 'saved' | 'failed';

export interface LabelFields {
  serial: string;
  name: string;
  student_id: string;
  department: string;
}

export interface SavedInfo {
  label: string | null;
  sid: string | null;
  bytes: number;
}

interface Options {
  /**
   * **铸号**。在标注确定之后、提交标注之前调用 —— 因为 `sessionApi.setLabel`
   * 需要 `session_id`,而服务端铸号是唯一来源。
   *
   * 返回 `false` ⟹ 中止这一场(不提交标注、不开录)。
   *
   * ⚠️ 铸号发生在**弹窗确定之后**,不是点按钮那一刻 —— `/analysis` 原先反着来
   *    (先铸号再弹窗),于是"点了开始又取消"会在盘上留一个**空壳场次目录**。
   *    9-28 那天实测留下过:`20260928_211917_72c1`,有 `label.json`、没有 media ——
   *    而它带着姓名/学号,比纯空壳更像一场真素材。改到确定之后 ⟹ 取消是干净地
   *    什么都没发生。
   */
  onPrepareSession?: () => void | boolean | Promise<void | boolean>;
  /** **开录**(开摄像头 + 开帧捕获)。在标注提交之后调用。
   *  标注提交失败**不会**拦到这里 —— 材料比标注值钱,不能因为服务端抖一下就丢一场。 */
  onRecordStart?: () => void | Promise<void>;
}

export const useSessionRecording = ({ onPrepareSession, onRecordStart }: Options = {}) => {
  // ── 标注 ────────────────────────────────────────────────────────────────
  const [labelFields, setLabelFields] = useState<LabelFields>({
    serial: '', name: '', student_id: '', department: '',
  });
  const [labelModalOpen, setLabelModalOpen] = useState(false);
  const [labelThenRecord, setLabelThenRecord] = useState(false);
  const [savingLabel, setSavingLabel] = useState(false);
  // 服务端**拼好的**那一个。界面显示它,不显示本地拼的 —— 拼法只允许有一处定义
  // (`session_meta.compose_label`)。
  const [savedLabel, setSavedLabel] = useState<string | null>(null);
  // 标注没存下的凭证。**常驻**,与降级同一个讲究。
  const [labelError, setLabelError] = useState<string | null>(null);

  // ── 保存门禁 ────────────────────────────────────────────────────────────
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [savedInfo, setSavedInfo] = useState<SavedInfo | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmAbandonOpen, setConfirmAbandonOpen] = useState(false);
  // 待上传的 blob + 那个**故意悬着**的 promise 的 resolve。见文件头 ②。
  const pendingRef = useRef<{ blob: Blob; resolve: () => void } | null>(null);
  const savedLabelRef = useRef<string | null>(null);

  // ── 降级 ────────────────────────────────────────────────────────────────
  const [degraded, setDegraded] = useState<string[]>([]);
  const addDegraded = useCallback((reason: string) => {
    console.warn('⚠️ 采集降级:', reason);
    setDegraded((prev) => (prev.includes(reason) ? prev : [...prev, reason]));
    message.warning(reason, 8);   // 当场看见
  }, []);

  const openLabelModal = useCallback((thenRecord: boolean) => {
    setLabelThenRecord(thenRecord);
    setLabelModalOpen(true);
  }, []);

  /** 真正上传。**成功才让那个 promise 落定** —— 落定 = 撤掉刷新拦截。 */
  const doUpload = useCallback(async (blob: Blob) => {
    setSaveState('saving');
    setSaveError(null);
    try {
      const result = await sessionApi.uploadMedia(blob);
      if (result?.stored === false) {
        // 服务端**明说没存下**(留存被关 / 中途写失败)—— 不许当成功。
        throw new Error(result.reason || '服务端明说没有留存');
      }
      console.log('✅ 原生录像已留存:', result);
      // `sid` 取**当下**模块变量里的那个,不是渲染时闭包里的 —— 上传是异步的,
      // 而这一场结束前页面可能已经换过场(那也正是门禁要拦住的事)。
      setSavedInfo({ label: savedLabelRef.current, sid: getSessionId(), bytes: blob.size });
      setSaveState('saved');
      pendingRef.current?.resolve();      // ← 到这里才撤掉「刷新会丢录像」拦截
      pendingRef.current = null;
      message.success('本场原生录像已留存');
    } catch (error: any) {
      // 没有会话 id / 网络断 / 服务端 409 / 413 … ⟹ 整场录像没留成。
      // 这是**不可逆**的损失,所以:① 常驻报错 ② **promise 继续悬着**(拦截还在)
      // ③ 给出重试入口 —— 绝不静默结束。
      const detail = error?.response?.data?.detail;
      const why = detail || error?.message || '未知错误';
      console.error('❌ 原生录像上传失败:', error?.response?.data ?? error);
      setSaveError(why);
      setSaveState('failed');
      message.error('本场原生录像没有留存 —— 别刷新页面,点「重试上传」', 0);
    }
  }, []);

  /** 交给 `useCamera` 的 `onVideoReady` 用。**必须 return 它的返回值。** */
  const submitVideo = useCallback((video: Blob): Promise<void> => {
    console.log('🎥 本场原生录像收尾，准备上传:', video.size, 'bytes');
    return new Promise<void>((resolve) => {
      pendingRef.current = { blob: video, resolve };
      void doUpload(video);
    });
  }, [doUpload]);

  const retryUpload = useCallback(() => {
    const p = pendingRef.current;
    if (!p) { setSaveState('idle'); return; }
    void doUpload(p.blob);
  }, [doUpload]);

  /** 放弃本场:放掉内存里那份 blob、撤掉拦截。**不可逆** ⟹ 走二次确认。
   *  留这个出口是因为:否则服务器一断,使用者就被永远锁在"不能开始下一场"上 ——
   *  而那时他至少该被允许**明说**"这场我不要了"。 */
  const abandonUpload = useCallback(() => {
    setConfirmAbandonOpen(false);
    pendingRef.current?.resolve();
    pendingRef.current = null;
    setSaveState('idle');
    setSaveError(null);
    setSavedInfo(null);
    message.warning('已放弃本场录像(未留存)');
  }, []);

  /** 标注弹窗的「确定」。**顺序是铸号 → 提交标注 → 开录**(见 `Options` 的说明)。
   *  标注存不下**不拦录制** —— 材料比标注值钱,不能因为服务端抖一下就丢一场;
   *  但存不下这件事必须**说出来**(常驻横幅,不是一闪而过的 toast)。 */
  const submitLabel = useCallback(async () => {
    setSavingLabel(true);
    try {
      if (labelThenRecord) {
        const prepared = await onPrepareSession?.();
        if (prepared === false) {
          // 铸号失败:不提交标注、不开录。调用方已经喊过了(它知道原因)。
          setLabelModalOpen(false);
          return;
        }
      }
      try {
        const r = await sessionApi.setLabel(labelFields);
        setSavedLabel(r?.label ?? null);
        savedLabelRef.current = r?.label ?? null;
        setLabelError(null);
        message.success(`本场标注已记录：${r?.label ?? ''}`);
      } catch (error: any) {
        console.error('❌ 本场标注没有记下:', error?.response?.data ?? error);
        const detail = error?.response?.data?.detail;
        setLabelError(detail || error?.message || '未知错误');
        message.error('本场标注没能记下(录像照录)—— 见页面顶部告警', 0);
      }
      setLabelModalOpen(false);
      if (labelThenRecord) await onRecordStart?.();
    } finally {
      setSavingLabel(false);
    }
  }, [labelFields, labelThenRecord, onPrepareSession, onRecordStart]);

  /** 换场前把上一场留在页面上的东西清干净。不清会串场(标注挂到新场上、
   *  降级横幅留着上一场的、保存状态卡住不让开下一场)。 */
  const reset = useCallback(() => {
    setDegraded([]);
    setSavedLabel(null);
    savedLabelRef.current = null;
    setLabelError(null);
    setSaveState('idle');
    setSavedInfo(null);
    setSaveError(null);
    setLabelModalOpen(false);
    setLabelThenRecord(false);
    pendingRef.current = null;
  }, []);

  return {
    // 标注
    labelFields, setLabelFields, labelModalOpen, labelThenRecord,
    openLabelModal, setLabelModalOpen, savingLabel, savedLabel, labelError, submitLabel,
    // 门禁
    saveState, savedInfo, saveError, submitVideo, retryUpload,
    confirmAbandonOpen, setConfirmAbandonOpen, abandonUpload,
    // 降级
    degraded, addDegraded,
    // 换场
    reset,
  };
};
