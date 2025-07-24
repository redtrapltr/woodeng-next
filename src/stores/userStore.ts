/* src/stores/userStore.ts */
import { create } from 'zustand';

interface User {
  /** wallet or db id – filled in later */
  id?: string;
  username?: string;
  avatarUrl?: string;
  coverUrl?: string;
  bio?: string;
  certification?: {
    status: 'none' | 'pending' | 'approved' | 'rejected';
    rejectionDate?: string;
  };
  /* allow future arbitrary profile fields */
  [key: string]: unknown;
}

interface State {
  user: User | null;
  updateUser: (partial: Partial<User>) => void;
}

export const useUserStore = create<State>()((set) => ({
  user: null,

  updateUser: (partial) =>
    set((state) => ({
      // if state.user is null, start from an empty object
      user: { ...(state.user ?? {}), ...partial },
    })),
}));
