import React from 'react';
import { Card } from 'antd';

interface CameraViewProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef?: React.RefObject<HTMLCanvasElement>;
  title?: string;
  showOverlay?: boolean;
  overlayContent?: React.ReactNode;
}

const CameraView: React.FC<CameraViewProps> = ({
  videoRef,
  canvasRef,
  title = '摄像头预览',
  showOverlay = false,
  overlayContent
}) => {
  return (
    <Card
      title={title}
      bordered={false}
      style={{ borderRadius: '8px' }}
      bodyStyle={{ padding: 0 }}
    >
      <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', background: '#000' }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover'
          }}
        />
        {canvasRef && (
          <canvas
            ref={canvasRef}
            style={{ display: 'none' }}
          />
        )}
        {showOverlay && overlayContent && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            pointerEvents: 'none'
          }}>
            {overlayContent}
          </div>
        )}
      </div>
    </Card>
  );
};

export default CameraView;
