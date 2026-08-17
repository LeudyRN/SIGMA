import { create } from 'zustand';

export interface AuthUser {
  email: string;
  id: string;
  matricula: string;
  name: string;
  roles: Array<{ code: string; name: string }>;
  uuid: string;
}

interface AuthState {
  setUser: (user: AuthUser | null) => void;
  user: AuthUser | null;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
}));
