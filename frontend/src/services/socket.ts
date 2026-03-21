import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SOCKET_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

class SocketService {
  private socket: Socket | null = null;
  private messageCallbacks: Map<string, (message: any) => void> = new Map();

  async connect() {
    if (this.socket?.connected) return;

    const token = await AsyncStorage.getItem('auth_token');
    
    this.socket = io(SOCKET_URL, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      auth: { token },
    });

    this.socket.on('connect', () => {
      console.log('Socket connected');
    });

    this.socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    this.socket.on('new_message', (message) => {
      this.messageCallbacks.forEach((callback) => callback(message));
    });

    this.socket.on('new_dm', (message) => {
      this.messageCallbacks.forEach((callback) => callback(message));
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  joinRoom(room: string) {
    if (this.socket) {
      this.socket.emit('join_room', { room });
    }
  }

  leaveRoom(room: string) {
    if (this.socket) {
      this.socket.emit('leave_room', { room });
    }
  }

  onMessage(id: string, callback: (message: any) => void) {
    this.messageCallbacks.set(id, callback);
  }

  offMessage(id: string) {
    this.messageCallbacks.delete(id);
  }
}

export const socketService = new SocketService();
