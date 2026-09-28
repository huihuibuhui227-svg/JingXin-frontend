import React, { useCallback, useEffect, useState } from 'react';
import { Button, Select, Space, Typography } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';

/**
 * 挑摄像头 / 麦克风。
 *
 * ⚠️ **设备名要拿到权限之后才有。** `enumerateDevices()` 在未授权时返回的 `label`
 *    是空串(浏览器的隐私设计),所以第一次打开时只能显示「摄像头 1 / 2」这种占位名。
 *    这里**如实显示占位名**,而不是编一个"Integrated Camera"出来 —— 编了的话,
 *    用户以为选对了、其实选的是另一个,而画面里出现谁完全是另一回事。
 *    拿到权限后(首次开录)`devicechange`/重新打开会显示出真名。
 *
 * ⚠️ `deviceId` 对同一个 origin 是稳定的,所以记得住。换台电脑/换浏览器就不认了
 *    (那是浏览器的 salt),那时会自动回落到"让浏览器自己挑"。
 */

const VIDEO_KEY = 'jx_video_device_id';
const AUDIO_KEY = 'jx_audio_device_id';

const read = (key: string): string | null => {
  try { return localStorage.getItem(key); } catch { return null; }
};
const write = (key: string, value: string | null): void => {
  try { value ? localStorage.setItem(key, value) : localStorage.removeItem(key); } catch { /* 隐私模式:记不住就记不住 */ }
};

export interface DeviceSelection {
  videoDeviceId: string | null;
  audioDeviceId: string | null;
}

/** 设备选择 + 记住上次选的。三个录制页共用(一处定义)。 */
export const useDeviceSelection = () => {
  const [selection, setSelection] = useState<DeviceSelection>({
    videoDeviceId: read(VIDEO_KEY),
    audioDeviceId: read(AUDIO_KEY),
  });

  const update = useCallback((next: DeviceSelection) => {
    setSelection(next);
    write(VIDEO_KEY, next.videoDeviceId);
    write(AUDIO_KEY, next.audioDeviceId);
  }, []);

  return { selection, update };
};

interface Props {
  value: DeviceSelection;
  onChange: (next: DeviceSelection) => void;
  /** 只采声音时摄像头那一栏没有意义 —— 禁用并说明,而不是让它看起来能选。 */
  audioOnly?: boolean;
}

const DevicePicker: React.FC<Props> = ({ value, onChange, audioOnly = false }) => {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [named, setNamed] = useState(false);

  const refresh = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      const usable = all.filter((d) => d.kind === 'videoinput' || d.kind === 'audioinput');
      setDevices(usable);
      setNamed(usable.some((d) => d.label));
    } catch (e) {
      console.warn('⚠️ 列不出设备:', e);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const md = navigator.mediaDevices;
    if (!md?.addEventListener) return;
    // 插拔设备时自动刷新 —— 否则下拉框会一直停在上次那份列表上。
    md.addEventListener('devicechange', refresh);
    return () => md.removeEventListener('devicechange', refresh);
  }, [refresh]);

  const optionsFor = (kind: MediaDeviceKind) =>
    devices.filter((d) => d.kind === kind).map((d, i) => ({
      // 拿不到名字就**如实说第几个**,不编一个设备名。
      label: d.label || `${kind === 'videoinput' ? '摄像头' : '麦克风'} ${i + 1}(${named ? '' : '未授权,名字待定'})`,
      value: d.deviceId,
    }));

  return (
    <Space direction="vertical" size={6} style={{ width: '100%' }}>
      <div>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>摄像头</Typography.Text>
        <Select
          style={{ width: '100%' }}
          size="small"
          disabled={audioOnly}
          allowClear
          placeholder={audioOnly ? '本场只采声音 —— 不打开摄像头' : '让浏览器自己挑'}
          value={value.videoDeviceId ?? undefined}
          options={optionsFor('videoinput')}
          onChange={(v) => onChange({ ...value, videoDeviceId: v ?? null })}
        />
      </div>
      <div>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>麦克风</Typography.Text>
        <Select
          style={{ width: '100%' }}
          size="small"
          allowClear
          placeholder="让浏览器自己挑"
          value={value.audioDeviceId ?? undefined}
          options={optionsFor('audioinput')}
          onChange={(v) => onChange({ ...value, audioDeviceId: v ?? null })}
        />
      </div>
      <div>
        <Button size="small" icon={<ReloadOutlined />} onClick={() => void refresh()}>刷新设备</Button>
        {!named && (
          <Typography.Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
            设备名要授权之后才有 —— 现在显示的是序号
          </Typography.Text>
        )}
      </div>
    </Space>
  );
};

export default DevicePicker;
