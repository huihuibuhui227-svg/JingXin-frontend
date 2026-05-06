
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UserState {
  userId: string | null;
  userName: string | null;
  email: string | null;
  avatar: string | null;
  isAuthenticated: boolean;

  setUser: (user: { userId: string; userName: string; email?: string; avatar?: string }) => void;
  clearUser: () => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      userId: null,
      userName: null,
      email: null,
      avatar: null,
      isAuthenticated: false,

      setUser: (user) => set({
        userId: user.userId,
        userName: user.userName,
        email: user.email || null,
        avatar: user.avatar || null,
        isAuthenticated: true
      }),

      clearUser: () => set({
        userId: null,
        userName: null,
        email: null,
        avatar: null,
        isAuthenticated: false
      })
    }),
    {
      name: 'user-storage'
    }
  )
);
