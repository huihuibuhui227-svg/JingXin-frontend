import React from 'react';
import { Alert, Input, Modal } from 'antd';
import { LabelFields, SaveState, SavedInfo } from '@/hooks/useSessionRecording';

/**
 * 「一场录制」的四个共用弹窗 + 一条降级横幅。
 *
 * 抽出来的理由与 `useSessionRecording` 同:同一套纪律出现在 `/analysis`、
 * `/interview`、`/research` 三处时,只留**一处定义**。抄三遍的结果是本仓反复
 * 栽过的那种「三处各自算一遍,然后静默分叉」。
 */

/** 从 sid 里取 `YYYYMMDD_HHMMSS` 那一段,给标注窗的"时间"用。
 *  ⚠️ **只读**:它取自 session_id 自己那一段(`session_meta.compose_label`)。
 *     让用户能改就会出现"标签说 20:35、文件名说 20:33",而标签存在的唯一理由
 *     就是能对上。 */
const sidTime = (sid: string | null): string =>
  sid ? sid.replace(/^(\d{8})_(\d{6}).*$/, '$1_$2') : '';

const LABEL_FIELDS = ([
  ['serial', '场次序号(你自己定的口径)'],
  ['name', '姓名'],
  ['student_id', '学号'],
  ['department', '院系'],
] as const);

export const LabelModal: React.FC<{
  open: boolean;
  /** true = 开录前填(确定后开始录制);false = 录完改标。 */
  thenRecord: boolean;
  fields: LabelFields;
  onChange: (fields: LabelFields) => void;
  onOk: () => void;
  onCancel: () => void;
  saving: boolean;
  sid: string | null;
  /** 上一次提交失败的原因(常驻,不是一闪而过的 toast)。 */
  error?: string | null;
}> = ({ open, thenRecord, fields, onChange, onOk, onCancel, saving, sid, error }) => {
  const preview = [sidTime(sid), fields.serial, fields.name, fields.student_id, fields.department]
    .map((v) => (v || '').trim()).filter(Boolean).join('-');
  const anyFilled = Object.values(fields).some((v) => v.trim());

  return (
    <Modal
      title={thenRecord ? '这一场是谁的?(确定后开始录制)' : '改本场标注'}
      open={open}
      onOk={onOk}
      okText={thenRecord ? '确定并开始录制' : '保存'}
      cancelText={thenRecord ? '取消(不录制)' : '取消'}
      confirmLoading={saving}
      onCancel={onCancel}
      maskClosable={false}
    >
      <div style={{ display: 'grid', gap: '12px', paddingTop: '8px' }}>
        <div>
          <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>
            时间(取自本场 session_id,不可改)
          </div>
          {/* ⚠️ 开录前填标时**还不知道** sid —— 铸号发生在"确定"之后(见
              `useSessionRecording` 的 `onPrepareSession`)。所以这里如实说"还不知道",
              而不是留一个看着像坏了的空框。录完改标时它是有的。 */}
          <Input value={sidTime(sid)} readOnly disabled
            placeholder={sid ? undefined : '(铸号之后才知道)'} />
        </div>
        {LABEL_FIELDS.map(([key, title]) => (
          <div key={key}>
            <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>{title}</div>
            <Input
              value={fields[key]}
              maxLength={120}
              onChange={(e) => onChange({ ...fields, [key]: e.target.value })}
            />
          </div>
        ))}
        <Alert
          type={anyFilled ? 'info' : 'warning'}
          showIcon
          message={anyFilled
            ? `标签预览：${preview}`
            : '四项全空等于没标 —— 至少填一项,否则事后认不出这一场'}
          description="这段预览只是给你当场看的;真正存下来的以服务端返回的那一个为准(拼法只允许有一处定义)。"
        />
        {error && (
          <Alert
            type="error" showIcon
            message={`上一次没能记下：${error}`}
            description="录像照录,不受影响。可以在这里重试。"
          />
        )}
      </div>
    </Modal>
  );
};

export const StopConfirmModal: React.FC<{
  open: boolean;
  onOk: () => void;
  onCancel: () => void;
  label: string | null;
  sid: string | null;
}> = ({ open, onOk, onCancel, label, sid }) => (
  <Modal
    title="确定停止录制?"
    open={open}
    onOk={onOk}
    onCancel={onCancel}
    okText="确定停止"
    cancelText="继续录制"
    okButtonProps={{ danger: true }}
  >
    <p style={{ marginBottom: '8px' }}>
      停止后本场原生录像会立刻上传留存,不能再往这一场里补录。
    </p>
    <p style={{ margin: 0, color: '#666', fontSize: '13px' }}>
      本场：{label ?? '(没有标注)'}
      <br />
      session_id：{sid ?? '(没有会话号)'}
    </p>
  </Modal>
);

/**
 * 保存门禁。**素材没确认留存,就不算"结束录制"**(使用者 2026-09-28 的裁定)。
 *
 * ⚠️ 遮罩不可关闭、不可点外面关、Esc 也不响应 —— 这是**刻意**的,它就是要拦住
 *    "手快"。录像整场只活在内存里,这一下点错就是永久丢一场。
 */
export const SaveGateModal: React.FC<{
  saveState: SaveState;
  savedInfo: SavedInfo | null;
  saveError: string | null;
  onRetry: () => void;
  onAbandon: () => void;
  onClose: () => void;
  /** `saved` 时额外给的动作(评估页在这里放「去看报告」「录下一场」)。 */
  extraActions?: React.ReactNode;
  /** 藏掉那个默认的「确定」。评估页要用:它后面没有"继续录"这条路,
   *  默认按钮关掉弹窗只会把人留在一条死路上 —— 必须二选一(去看报告 / 录下一场)。 */
  hideDefaultOk?: boolean;
}> = ({ saveState, savedInfo, saveError, onRetry, onAbandon, onClose, extraActions,
        hideDefaultOk }) => (
  <Modal
    title={saveState === 'saving' ? '正在保存本场录像…'
      : saveState === 'saved' ? '✅ 本场已留存'
        : '❌ 本场录像没有留存'}
    open={saveState !== 'idle'}
    closable={false}
    maskClosable={false}
    keyboard={false}
    footer={
      saveState === 'saved' ? (
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          {!hideDefaultOk && (
            <button key="ok" onClick={onClose}
              style={{ padding: '6px 20px', background: '#1890ff', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
              确定(现在可以录下一场了)
            </button>
          )}
          {extraActions}
        </div>
      ) : saveState === 'failed' ? (
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button key="retry" onClick={onRetry}
            style={{ padding: '6px 20px', background: '#1890ff', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
            重试上传
          </button>
          <button key="drop" onClick={onAbandon}
            style={{ padding: '6px 20px', background: '#fff', color: '#ff4d4f', border: '1px solid #ff4d4f', borderRadius: '6px', cursor: 'pointer' }}>
            放弃本场
          </button>
        </div>
      ) : undefined
    }
  >
    {saveState === 'saving' && (
      <p style={{ margin: 0 }}>
        录像正在上传留存 —— <strong>请不要刷新或关闭页面</strong>,传完会自动告诉你。
      </p>
    )}
    {saveState === 'saved' && savedInfo && (
      <div style={{ fontSize: '14px', lineHeight: 1.9 }}>
        <div>本场：<strong>{savedInfo.label ?? '(没有标注)'}</strong></div>
        <div>session_id：{savedInfo.sid ?? '(没有会话号)'}</div>
        <div>素材：<strong>{(savedInfo.bytes / 1048576).toFixed(1)} MB</strong>(原生音视频,已落盘)</div>
        <p style={{ margin: '10px 0 0', color: '#666', fontSize: '13px' }}>
          确认之后才能开始下一场。现在刷新页面也安全了。
        </p>
      </div>
    )}
    {saveState === 'failed' && (
      <div>
        <p style={{ marginTop: 0 }}>
          这份录像<strong>还在内存里,没有落盘</strong>。别刷新、别关页面 ——
          刷新会让它<strong>永久丢失</strong>。
        </p>
        <p style={{ margin: 0, color: '#cf1322', fontSize: '13px' }}>原因：{saveError}</p>
      </div>
    )}
  </Modal>
);

export const AbandonConfirmModal: React.FC<{
  open: boolean;
  onOk: () => void;
  onCancel: () => void;
  label: string | null;
  sid: string | null;
}> = ({ open, onOk, onCancel, label, sid }) => (
  <Modal
    title="确定放弃这一场的录像?"
    open={open}
    onOk={onOk}
    onCancel={onCancel}
    okText="确定放弃"
    cancelText="再试一次"
    okButtonProps={{ danger: true }}
  >
    <p style={{ marginBottom: '8px' }}>
      它<strong>只存在于内存里</strong>,放弃之后<strong>无法找回</strong>。
    </p>
    <p style={{ margin: 0, color: '#666', fontSize: '13px' }}>
      本场：{label ?? '(没有标注)'}　session_id：{sid ?? '(没有会话号)'}
    </p>
  </Modal>
);

/** 降级凭证。**常驻**在页面上 —— toast 8 秒后溜走,而"这一场算不算数"是个
 *  转过头还要再看一眼的问题。 */
export const DegradedBanner: React.FC<{ reasons: string[] }> = ({ reasons }) => {
  if (reasons.length === 0) return null;
  return (
    <Alert
      style={{ marginBottom: 16 }}
      type="warning"
      showIcon
      message={`本场采集有 ${reasons.length} 处降级 —— 这一场的素材与"正常那一场"不是一回事`}
      description={<ul style={{ margin: 0, paddingLeft: 18 }}>
        {reasons.map((r) => <li key={r}>{r}</li>)}
      </ul>}
    />
  );
};

export const LabelErrorBanner: React.FC<{ error: string | null }> = ({ error }) => {
  if (!error) return null;
  return (
    <Alert
      style={{ marginBottom: 16 }}
      type="error"
      showIcon
      message={`本场标注没有记下：${error}`}
      description="录像不受影响;可点页面顶部「改本场标注」重试。"
    />
  );
};
