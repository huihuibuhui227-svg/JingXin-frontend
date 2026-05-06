
import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from '@/utils/constants';

class WebSocketService {
  private socket: Socket | null = null;
  private maxReconnectAttempts = 5;

  connect(onMetricsUpdate?: (metrics: any) => void) {
    if (this.socket?.connected) return;

    this.socket = io(API_BASE_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: this.maxReconnectAttempts
    });

    this.socket.on('connect', () => {
      console.log('WebSocket connected');
    });

    this.socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
    });

    this.socket.on('reconnect_attempt', (attempt) => {
      console.log(`重连尝试 ${attempt}/${this.maxReconnectAttempts}`);
    });

    this.socket.on('reconnect_error', (error) => {
      console.error('重连错误:', error);
    });

    if (onMetricsUpdate) {
      this.socket.on('metrics_update', onMetricsUpdate);
    }

    this.socket.on('error', (error) => {
      console.error('WebSocket错误:', error);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  emit(event: string, data: any) {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn('WebSocket未连接');
    }
  }

  on(event: string, callback: (...args: any[]) => void) {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event: string, callback?: (...args: any[]) => void) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

export const websocketService = new WebSocketService();

