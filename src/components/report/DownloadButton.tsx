/**
 * 报告页的「下载报告」按钮 —— **必须有去处**,没去处就明说没去处。
 *
 * ## 修的是什么(2026-11-21)
 *
 * 此前 `ReportPage` 里写的是 `<DownloadButton />` —— **一个 prop 都没传**。
 * 而组件内部是 `if (onDownload) … else if (reportUrl) …`,两条路都不成立,
 * `handleDownload` 于是**静默返回**:按钮是亮的、点下去什么都不发生、也没有一句话。
 * 现场演示时这就是"点下载,没反应"。
 *
 * ## 现在的契约
 *
 * | 传了什么 | 按钮 |
 * |---|---|
 * | `onDownload`(调用方自己准备并触发下载) | 可点,点它 |
 * | `href`(报告文件已经在盘上,走静态路由 `/output/<name>`) | 可点,直接下 |
 * | 什么都没传 | **禁用**,鼠标悬停显示 `disabledReason`(默认「报告尚未生成」) |
 *
 * 两个都传时以 `onDownload` 为准(调用方可能要先"生成再下",那条路自己会用到 `href`)。
 * `href` / `onDownload` 仍标成可选 —— 这是**故意**的:旧调用点(`<DownloadButton />`)
 * 得能继续编译通过,并在运行时退化成"禁用 + 说明",而不是类型报错或静默无效。
 * 换句话说:**props 是运行时的必需品,不是类型层的硬约束**。
 *
 * ## 为什么不像以前那样只靠 `utils/helpers.ts` 的 `downloadFile`
 *
 * 它只做 `<a download>`:`download` 属性在**跨源**时会被浏览器忽略,那时点下去
 * 会**把报告页顶掉**、直接跳到裸 HTML。后端 `getFiles` 发的都是相对路径
 * (`/output/<name>`,开发期经 vite 代理、生产期与页面同源),所以同源情况用
 * `downloadFile`(语义一致、真存盘);万一哪天传进来的是绝对地址,就退回
 * `<a target="_blank">`,宁可新开一个标签,也不动当前页面。
 */
import React from 'react';
import { Button, Tooltip } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { downloadFile } from '@/utils/helpers';

export interface DownloadButtonProps {
  /** 报告文件地址(后端静态路由 `/output/<name>`,或绝对地址)。 */
  href?: string | null;
  /** 下载到本地时的文件名。 */
  filename?: string;
  /** 自定义下载动作;给了就以它为准(用于"先生成、再下载"这类流程)。 */
  onDownload?: () => void;
  /** 正在准备(生成/请求)中 —— 期间按钮转圈且不可再点。 */
  loading?: boolean;
  /** 禁用时 tooltip 上的那句话。默认「报告尚未生成」。 */
  disabledReason?: string;
}

/** 同源判定:相对路径、或与本页 origin 前缀一致的绝对地址。 */
const isSameOrigin = (url: string): boolean =>
  url.startsWith('/') || url.startsWith(`${window.location.origin}/`);

const triggerDownload = (url: string, filename: string): void => {
  if (isSameOrigin(url)) {
    downloadFile(url, filename);
    return;
  }
  // 跨源:浏览器会忽略 `download` ⟹ 用新标签打开,绝不把当前页顶掉。
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener';
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

const DownloadButton: React.FC<DownloadButtonProps> = ({
  href,
  filename = '评估报告.html',
  onDownload,
  loading = false,
  disabledReason
}) => {
  const hasAction = Boolean(onDownload) || Boolean(href);
  const disabled = !hasAction || loading;
  const reason = disabledReason ?? (loading ? '正在生成报告…' : '报告尚未生成');

  const handleClick = () => {
    if (!hasAction) return; // 双保险:禁用态本来点不到
    if (onDownload) {
      onDownload();
      return;
    }
    if (href) triggerDownload(href, filename);
  };

  const button = (
    <Button
      type="primary"
      icon={<DownloadOutlined />}
      onClick={handleClick}
      disabled={disabled}
      loading={loading}
      aria-label={disabled ? `下载报告(不可用:${reason})` : '下载报告'}
    >
      下载报告
    </Button>
  );

  if (!disabled) return button;

  // ⚠️ 禁用的 antd Button 不派发鼠标事件 ⟹ Tooltip 必须挂在外面包一层 `<span>`,
  //    直接挂在 Button 上时"为什么不能点"这句话永远出不来(用户只会看到灰按钮)。
  return (
    <Tooltip title={reason}>
      <span style={{ display: 'inline-block', cursor: 'not-allowed' }}>{button}</span>
    </Tooltip>
  );
};

export default DownloadButton;
