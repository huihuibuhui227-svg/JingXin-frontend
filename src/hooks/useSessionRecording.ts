import { useCallback, useRef, useState } from 'react';
import { message } from 'antd';
import { sessionApi, getSessionId } from '@/services/api';
import { recordingsApi } from '@/services/recordingsApi';
import { ConsentMode } from '@/components/recording/RecordingDialogs';

/**
 * 「一场录制」的四件共用物:**本场标注**、**肖像/音频征询**、**留存处置**、**降级凭证**。
 *
 * 三个录制页(`/analysis`、`/interview`、`/research`)共用这一份 —— 抄三遍的下场
 * 就是本仓反复栽过的「几处各自算一遍,然后静默分叉」。
 *
 * ── 顺序是刻意的 ────────────────────────────────────────────────────────
 *
 * ```
 *   点「开始」 → 标注窗(填是谁) → 征询窗(同意什么 + 选设备)
 *        → 铸号 → 提交标注(含 consent) → 按 consent 开录
 *   结束录制   → 停采集 → 问「留存 / 不留存」
 *        留存   → 传原生录像            → ✅ 已留存
 *        不留存 → 丢掉内存里的录像 + 服务端真删 → 已删除,没有入盘
 * ```
 *
 * ⚠️ **铸号在征询之后**。所以「不同意」= 盘上连目录都不会建 —— 不需要"先建再删",
 *    也就不会留下空壳场次(9-28 那天留下过带标注的空壳)。
 *
 * ⚠️ **征询结果随标注一起落 `label.json`**。它只活在页面状态里的话,事后**无法证明**
 *    这一场是经同意的 —— 而这是一个拿真人脸和声音做素材的系统。
 */

export type SaveState =
  | 'idle'        // 没在处置
  | 'choosing'    // 刚停录,等使用者选「留存 / 不留存」
  | 'saving'      // 正在上传原生录像
  | 'saved'       // 已留存
  | 'failed'      // 上传失败(blob 还在内存里,刷新就永久丢)
  | 'purging'     // 正在真删
  | 'purged';     // 已真删(没入盘)

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
  /** **铸号**。在征询确定之后、提交标注之前调用(`setLabel` 需要 `session_id`)。
   *  返回 `false` ⟹ 中止这一场(不提交标注、不开录)。 */
  onPrepareSession?: () => void | boolean | Promise<void | boolean>;
  /** **开录**。在标注提交之后调用,参数是征询结果 —— 调用方据此决定
   *  **开不开摄像头**。标注提交失败**不会**拦到这里(材料比标注值钱)。 */
  onRecordStart?: (consent: ConsentMode) => void | Promise<void>;
}

export const useSessionRecording = ({ onPrepareSession, onRecordStart }: Options = {}) => {
  // ── 标注 ────────────────────────────────────────────────────────────────
  const [labelFields, setLabelFields] = useState<LabelFields>({
    serial: '', name: '', student_id: '', department: '',
  });
  const [labelModalOpen, setLabelModalOpen] = useState(false);
  const [labelThenRecord, setLabelThenRecord] = useState(false);
  const [savingLabel, setSavingLabel] = useState(false);
  const [savedLabel, setSavedLabel] = useState<string | null>(null);
  const [labelError, setLabelError] = useState<string | null>(null);
  const savedLabelRef = useRef<string | null>(null);

  // ── 征询(肖像 / 音频权)──────────────────────────────────────────────────
  const [consentModalOpen, setConsentModalOpen] = useState(false);
  const [consent, setConsent] = useState<ConsentMode | null>(null);
  const consentRef = useRef<ConsentMode | null>(null);

  // ── 留存处置 ────────────────────────────────────────────────────────────
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [savedInfo, setSavedInfo] = useState<SavedInfo | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmAbandonOpen, setConfirmAbandonOpen] = useState(false);
  /** 待上传的 blob + 那个**故意悬着**的 promise 的 resolve —— `useCamera` 拿它当
   *  "何时能撤掉「刷新会丢录像」拦截"的信号。 */
  const pendingRef = useRef<{ blob: Blob; resolve: () => void } | null>(null);
  /** 上一次失败发生在哪一步 —— 「重试」要重试**那一步**,不是永远重试上传。 */
  const failedFromRef = useRef<'upload' | 'discard' | null>(null);

  // ── 降级 ────────────────────────────────────────────────────────────────
  const [degraded, setDegraded] = useState<string[]>([]);
  const addDegraded = useCallback((reason: string) => {
    console.warn('⚠️ 采集降级:', reason);
    setDegraded((prev) => (prev.includes(reason) ? prev : [...prev, reason]));
    message.warning(reason, 8);
  }, []);

  const openLabelModal = useCallback((thenRecord: boolean) => {
    setLabelThenRecord(thenRecord);
    setLabelModalOpen(true);
  }, []);

  const setLabelModalOpenSafe = useCallback((open: boolean) => {
    setLabelModalOpen(open);
    // 第 1 步(标注)被取消 ⟹ 整条链就断了,别把征询窗留着。
    if (!open && labelThenRecord) setConsentModalOpen(false);
  }, [labelThenRecord]);

  /** 标注窗的「确定」。**先弹征询,不直接提交** —— 征询结果要和标注一起提交。 */
  const submitLabel = useCallback(() => {
    setLabelModalOpen(false);
    setConsentModalOpen(true);
  }, []);

  /** 征询窗的「同意」(模式由弹窗选)。铸号 → 提交标注(含 consent)→ 开录。 */
  const confirmConsent = useCallback(async (mode: ConsentMode) => {
    setConsent(mode);
    consentRef.current = mode;
    setConsentModalOpen(false);
    setSavingLabel(true);
    try {
      const prepared = await onPrepareSession?.();
      if (prepared === false) {
        message.error('这一场没有开始 —— 会话没有铸成,采不到任何素材', 0);
        return;
      }
      try {
        const r = await sessionApi.setLabel({ ...labelFields, consent: mode });
        setSavedLabel(r?.label ?? null);
        savedLabelRef.current = r?.label ?? null;
        setLabelError(null);
        message.success(`本场标注已记录：${r?.label ?? ''}`);
      } catch (error: any) {
        // 材料比标注值钱:标注存不下**不拦录制**。但必须留痕 —— 一场没标的录像
        // 事后认不出是谁的,而"认不出"与"没标"在文件上长得一模一样。
        console.error('❌ 本场标注没有记下:', error?.response?.data ?? error);
        const detail = error?.response?.data?.detail;
        setLabelError(detail || error?.message || '未知错误');
        message.error('本场标注没能记下(录像照录)—— 见页面顶部告警', 0);
      }
      await onRecordStart?.(mode);
    } finally {
      setSavingLabel(false);
    }
  }, [labelFields, onPrepareSession, onRecordStart]);

  /** 征询窗的「不同意」。**什么都不做** —— 铸号还没发生,盘上不会有任何东西。 */
  const declineConsent = useCallback(() => {
    setConsentModalOpen(false);
    setConsent(null);
    consentRef.current = null;
    message.info('已按「不同意」处理 —— 这一场没有开始采集');
  }, []);

  // ── 留存处置 ────────────────────────────────────────────────────────────

  /** 真正上传。**成功才让那个 promise 落定** —— 落定 = 撤掉刷新拦截。 */
  const doUpload = useCallback(async (blob: Blob) => {
    setSaveState('saving');
    setSaveError(null);
    try {
      const result = await sessionApi.uploadMedia(blob);
      if (result?.stored === false) {
        throw new Error(result.reason || '服务端明说没有留存');
      }
      console.log('✅ 原生录像已留存:', result);
      setSavedInfo({ label: savedLabelRef.current, sid: getSessionId(), bytes: blob.size });
      setSaveState('saved');
      pendingRef.current?.resolve();
      pendingRef.current = null;
      message.success('本场原生录像已留存');
    } catch (error: any) {
      const detail = error?.response?.data?.detail;
      const why = detail || error?.message || '未知错误';
      console.error('❌ 原生录像上传失败:', error?.response?.data ?? error);
      failedFromRef.current = 'upload';
      setSaveError(why);
      setSaveState('failed');
      message.error('本场原生录像没有留存 —— 别刷新页面,点「重试上传」', 0);
    }
  }, []);

  /** 交给 `useCamera` 的 `onVideoReady`。**必须 return 它的返回值。** */
  const submitVideo = useCallback((video: Blob): Promise<void> => {
    console.log('🎥 本场原生录像收尾，准备上传:', video.size, 'bytes');
    return new Promise<void>((resolve) => {
      pendingRef.current = { blob: video, resolve };
      // ⚠️ 这里**不立刻上传** —— 先让使用者选「留存 / 不留存」。录像留在内存里,
      //    那个 promise 悬着,刷新拦截也还在(选之前刷新 = 永久丢)。
      setSaveState('choosing');
    });
  }, []);

  /** 刚停录、还没有内存里的 blob(比如"只采声音"或摄像头没起来)—— 也要让使用者
   *  选一次留存 / 不留存:盘上已经有帧和音频了,那同样是"要不要留"的问题。 */
  const beginChoice = useCallback(() => {
    if (saveStateRef.current === 'idle') setSaveState('choosing');
  }, []);
  const saveStateRef = useRef<SaveState>('idle');
  saveStateRef.current = saveState;

  /** 「留存」。有内存里的录像就传;没有的话盘上那些本来就是留下的 ⟹ 直接确认。 */
  const chooseKeep = useCallback(() => {
    const p = pendingRef.current;
    if (p) { void doUpload(p.blob); return; }
    setSavedInfo({ label: savedLabelRef.current, sid: getSessionId(), bytes: 0 });
    setSaveState('saved');
    message.success('本场已确认留存');
  }, [doUpload]);

  /**
   * 「不留存 / 这是测试」。**真删**,没有回收站。
   *
   * ⚠️ 两件事都要做:丢掉内存里那份录像(**否则它还会被上传**),再让服务端把
   *    已经落盘的场次目录与三份日志 CSV 删掉。少做任何一件,"不留存"就是假的。
   */
  const chooseDiscard = useCallback(async () => {
    const sid = getSessionId();
    if (!sid) {
      // 连会话号都没有 ⟹ 盘上按 sid 落的那两处都不存在。但**不能静默**:
      // 使用者以为删了、其实什么都没发生,那是最坏的一种“成功”。
      failedFromRef.current = 'discard';
      setSaveState('failed');
      setSaveError('没有本场 session_id —— 无法定位要删的东西');
      message.error('本场没有 session_id,删不掉任何东西', 0);
      return;
    }
    setSaveState('purging');
    setSaveError(null);
    // ① 内存里那份:落定 promise(撤掉刷新拦截)并丢掉引用 —— 绝不上传。
    pendingRef.current?.resolve();
    pendingRef.current = null;
    // ② 盘上那份:服务端真删。
    try {
      const r = await recordingsApi.discard(sid);
      console.log('🗑️ 本场已作废:', r);
      setSavedInfo({ label: savedLabelRef.current, sid, bytes: 0 });
      setSaveState('purged');
      message.success('本场没有入盘 —— 场次目录与日志已删除');
    } catch (error: any) {
      const detail = error?.response?.data?.detail;
      const why = detail || error?.message || '未知错误';
      console.error('❌ 作废失败 —— 素材还在盘上:', error?.response?.data ?? error);
      failedFromRef.current = 'discard';
      setSaveError(why);
      setSaveState('failed');
      message.error('本场没有删掉 —— 素材还在盘上,请重试或到素材页手工删除', 0);
    }
  }, []);

  const retryUpload = useCallback(() => {
    const p = pendingRef.current;
    if (!p) { setSaveState('idle'); return; }
    void doUpload(p.blob);
  }, [doUpload]);

  /** 「重试」:重试**失败的那一步**。上传失败就重传,删除失败就重删 ——
   *  永远重试上传会让"删不掉"变成一个按了没反应的按钮。 */
  const retryLast = useCallback(() => {
    if (failedFromRef.current === 'discard') void chooseDiscard();
    else retryUpload();
  }, [chooseDiscard, retryUpload]);

  /** 放弃本场:放掉内存里那份 blob、撤掉拦截。**不可逆** ⟹ 走二次确认。 */
  const abandonUpload = useCallback(() => {
    setConfirmAbandonOpen(false);
    pendingRef.current?.resolve();
    pendingRef.current = null;
    setSaveState('idle');
    setSaveError(null);
    setSavedInfo(null);
    message.warning('已放弃本场录像(未留存)');
  }, []);

  /** 换场前把上一场留在页面上的东西清干净。 */
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
    setConsentModalOpen(false);
    setConsent(null);
    consentRef.current = null;
    pendingRef.current = null;
  }, []);

  return {
    // 标注
    labelFields, setLabelFields, labelModalOpen, labelThenRecord,
    openLabelModal, setLabelModalOpen: setLabelModalOpenSafe, savingLabel,
    savedLabel, labelError, submitLabel,
    // 征询
    consentModalOpen, consent, confirmConsent, declineConsent,
    // 留存处置
    saveState, savedInfo, saveError, submitVideo, beginChoice, chooseKeep, chooseDiscard,
    retryLast, confirmAbandonOpen, setConfirmAbandonOpen, abandonUpload,
    // 降级
    degraded, addDegraded,
    // 换场
    reset,
  };
};
