import React, { useState } from 'react';
import { Alert, Input, Modal, Radio, Space, Typography } from 'antd';
import { LabelFields, SaveState, SavedInfo } from '@/hooks/useSessionRecording';

/** `full` = 摄像头 + 麦克风全开;`audio_only` = 只开麦克风。 */
export type ConsentMode = 'full' | 'audio_only';

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
          <div style={{ fontSize: '13px', color: 'var(--ax-text-secondary)', marginBottom: '4px' }}>
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
            <div style={{ fontSize: '13px', color: 'var(--ax-text-secondary)', marginBottom: '4px' }}>{title}</div>
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

/**
 * 肖像与音频权的征询。**每场都弹** —— 每个受试者单独同意,不做"这台电脑记住"。
 *
 * ⚠️ 放在**铸号之前**(由调用方的流程保证)。所以「不同意」= 什么都不做,
 *    盘上连目录都不会建 —— 不需要"先建再删",也就不会留下空壳场次。
 *
 * ⚠️ 选「只录声音」时摄像头**一个字节都不开**:不是"开了但不存"。`media/face/*.jpg`
 *    是逐帧落盘的正脸照,所以"不录肖像"必须意味着**不开摄像头**,否则那些 jpg
 *    就是肖像。代价是这一场 face / gesture 两个模态完全没有数据,报告里如实显示
 *    "未采集"。
 */
export const ConsentModal: React.FC<{
  open: boolean;
  onOk: (mode: ConsentMode) => void;
  /** 不同意录制。**不是"取消"** —— 语义是"这场不录",所以文案要这么说。 */
  onDecline: () => void;
  /** 设备选择那一块(由调用方塞进来,免得这里耦合到具体实现)。 */
  devicePicker?: React.ReactNode;
  label?: string | null;
  saving?: boolean;
}> = ({ open, onOk, onDecline, devicePicker, label, saving }) => {
  const [mode, setMode] = useState<ConsentMode>('full');
  return (
    <Modal
      title="这一场需要征得同意"
      open={open}
      onOk={() => onOk(mode)}
      okText="确定并开始录制"
      cancelText="不同意(不录制)"
      okButtonProps={{ disabled: saving }}
      confirmLoading={saving}
      onCancel={onDecline}
      maskClosable={false}
      width={520}
    >
      <Space direction="vertical" size={12} style={{ width: '100%', paddingTop: 8 }}>
        <Typography.Paragraph style={{ margin: 0 }}>
          本场会采集并留存你的<strong>声音</strong>与<strong>影像</strong>,用于行为分析。
          请选择你同意的范围:
        </Typography.Paragraph>
        <Radio.Group value={mode} onChange={(e) => setMode(e.target.value)}>
          <Space direction="vertical" size={8}>
            <Radio value="full">
              <strong>全部同意</strong>
              <div style={{ fontSize: 12, color: 'var(--ax-text-secondary)' }}>
                摄像头与麦克风全开。录像、逐帧画面、语音都留存。
              </div>
            </Radio>
            <Radio value="audio_only">
              <strong>只同意声音</strong>
              <div style={{ fontSize: 12, color: 'var(--ax-text-secondary)' }}>
                <strong>摄像头不会被打开</strong> —— 本场不产生任何画面。代价是
                面部与手势两个维度<strong>没有数据</strong>,报告里会如实标注「未采集」。
              </div>
            </Radio>
          </Space>
        </Radio.Group>

        <div>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>采集设备</Typography.Text>
          {devicePicker}
        </div>

        {label && (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            本场:{label}
          </Typography.Text>
        )}
        <Alert
          type="info" showIcon
          message="点「不同意」这一场就不会开始 —— 盘上不会留下任何东西"
          description="（同意与否会随本场标注一起记下来,以便事后核对。）"
        />
      </Space>
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
    <p style={{ margin: 0, color: 'var(--ax-text-secondary)', fontSize: '13px' }}>
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
  /** 「留存」—— 有内存里的录像就上传,没有就确认盘上那些留着。 */
  onKeep: () => void;
  /** 「不留存 / 这是测试」—— **真删**,没有回收站。 */
  onDiscard: () => void;
  /** 「重试」:重试**失败的那一步**(上传或删除)。 */
  onRetry: () => void;
  onAbandon: () => void;
  onClose: () => void;
  /** `saved`/`purged` 时额外给的动作(评估页在这里放「去看报告」「录下一场」)。 */
  extraActions?: React.ReactNode;
  /** 藏掉那个默认的「确定」。评估页要用:它后面没有"继续录"这条路,
   *  默认按钮关掉弹窗只会把人留在一条死路上 —— 必须二选一。 */
  hideDefaultOk?: boolean;
}> = ({ saveState, savedInfo, saveError, onKeep, onDiscard, onRetry, onAbandon,
        onClose, extraActions, hideDefaultOk }) => {
  const btn = (bg: string, color: string, border = 'none'): React.CSSProperties => ({
    padding: '6px 20px', background: bg, color, border, borderRadius: 6, cursor: 'pointer',
  });

  const footer = saveState === 'choosing' ? (
    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
      {/* ⚠️ 两个按钮都写清**后果**,不写"确定/取消" —— 这一下点错是不可逆的。 */}
      <button onClick={onKeep} style={btn('var(--ax-primary)', '#fff')}>留存本场</button>
      <button onClick={onDiscard} style={btn('#fff', 'var(--ax-error)', '1px solid var(--ax-error)')}>
        不留存(这是测试)
      </button>
    </div>
  ) : saveState === 'saving' || saveState === 'purging' ? undefined
    : saveState === 'saved' || saveState === 'purged' ? (
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        {!hideDefaultOk && (
          <button onClick={onClose} style={btn('var(--ax-primary)', '#fff')}>
            确定(现在可以录下一场了)
          </button>
        )}
        {extraActions}
      </div>
    ) : (
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button onClick={onRetry} style={btn('var(--ax-primary)', '#fff')}>重试</button>
        <button onClick={onAbandon} style={btn('#fff', 'var(--ax-error)', '1px solid var(--ax-error)')}>
          放弃本场
        </button>
      </div>
    );

  return (
    <Modal
      title={saveState === 'choosing' ? '本场怎么处理?'
        : saveState === 'saving' ? '正在保存本场录像…'
          : saveState === 'purging' ? '正在删除本场素材…'
            : saveState === 'saved' ? '本场已留存'
              : saveState === 'purged' ? '本场没有入盘'
                : '本场没有处理成功'}
      open={saveState !== 'idle'}
      closable={false}
      maskClosable={false}
      keyboard={false}
      footer={footer}
    >
      {saveState === 'choosing' && (
        <div style={{ fontSize: 14, lineHeight: 1.9 }}>
          <p style={{ marginTop: 0 }}>
            采集已经停了。请选本场怎么处理 —— <strong>这一下不可逆</strong>。
          </p>
          <ul style={{ margin: '0 0 4px', paddingLeft: 18, color: 'var(--ax-text-secondary)', fontSize: 13 }}>
            <li><strong>留存</strong>:原生录像上传落盘,与帧、日志一起进素材库。</li>
            <li><strong>不留存</strong>:原生录像<strong>直接丢弃</strong>(它只在内存里),
              并让服务端把已落盘的场次目录与三份日志 CSV <strong>一起删掉</strong>。</li>
          </ul>
        </div>
      )}
      {saveState === 'saving' && (
        <p style={{ margin: 0 }}>
          录像正在上传留存 —— <strong>请不要刷新或关闭页面</strong>,传完会自动告诉你。
        </p>
      )}
      {saveState === 'purging' && (
        <p style={{ margin: 0 }}>正在从盘上删除本场的素材与日志…</p>
      )}
      {(saveState === 'saved' || saveState === 'purged') && savedInfo && (
        <div style={{ fontSize: 14, lineHeight: 1.9 }}>
          <div>本场：<strong>{savedInfo.label ?? '(没有标注)'}</strong></div>
          <div>session_id：{savedInfo.sid ?? '(没有会话号)'}</div>
          {saveState === 'saved' ? (
            <div>素材：<strong>{savedInfo.bytes
              ? `${(savedInfo.bytes / 1048576).toFixed(1)} MB`
              : '(本场没有原生录像,盘上只有帧与日志)'}</strong></div>
          ) : (
            <div style={{ color: 'var(--ax-error)' }}>
              已删除 —— 场次目录与日志 CSV 都从盘上抹掉了,<strong>没有入盘</strong>。
            </div>
          )}
          <p style={{ margin: '10px 0 0', color: 'var(--ax-text-secondary)', fontSize: 13 }}>
            确认之后才能开始下一场。现在刷新页面也安全了。
          </p>
        </div>
      )}
      {saveState === 'failed' && (
        <div>
          <p style={{ marginTop: 0 }}>
            本场<strong>还没有处理成功</strong>。别刷新、别关页面 ——
            刷新可能让内存里那份录像<strong>永久丢失</strong>,或让盘上的素材
            <strong>留在那里而你以为删了</strong>。
          </p>
          <p style={{ margin: 0, color: 'var(--ax-error)', fontSize: 13 }}>原因：{saveError}</p>
        </div>
      )}
    </Modal>
  );
};

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
    <p style={{ margin: 0, color: 'var(--ax-text-secondary)', fontSize: '13px' }}>
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
