
import React from 'react';
import { Button } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { downloadFile } from '@/utils/helpers';

interface DownloadButtonProps {
  reportUrl?: string;
  filename?: string;
  onDownload?: () => void;
}

const DownloadButton: React.FC<DownloadButtonProps> = ({
  reportUrl,
  filename = '评估报告.html',
  onDownload
}) => {
  const handleDownload = () => {
    if (onDownload) {
      onDownload();
    } else if (reportUrl) {
      downloadFile(reportUrl, filename);
    }
  };

  return (
    <Button
      type="primary"
      icon={<DownloadOutlined />}
      onClick={handleDownload}
    >
      下载报告
    </Button>
  );
};

export default DownloadButton;
