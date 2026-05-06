
import { create } from 'zustand';

interface UIState {
  theme: 'light' | 'dark';
  sidebarCollapsed: boolean;
  loading: boolean;
  modalVisible: boolean;
  notificationCount: number;

  toggleTheme: () => void;
  toggleSidebar: () => void;
  setLoading: (loading: boolean) => void;
  setModalVisible: (visible: boolean) => void;
  setNotificationCount: (count: number) => void;
}

export const useUIStore = create<UIState>((set) => ({
  theme: 'light',
  sidebarCollapsed: false,
  loading: false,
  modalVisible: false,
  notificationCount: 0,

  toggleTheme: () => set((state) => ({
    theme: state.theme === 'light' ? 'dark' : 'light'
  })),

  toggleSidebar: () => set((state) => ({
    sidebarCollapsed: !state.sidebarCollapsed
  })),

  setLoading: (loading) => set({ loading }),

  setModalVisible: (visible) => set({ modalVisible: visible }),

  setNotificationCount: (count) => set({ notificationCount: count })
}));
