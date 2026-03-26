import { create } from 'zustand';

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  imageUrl?: string;
}

interface Workspace {
  id: string;
  name: string;
  plan: string;
  role: string;
}

interface AuthState {
  user: User | null;
  activeWorkspace: Workspace | null;
  workspaces: Workspace[];
  setUser: (user: User | null) => void;
  setActiveWorkspace: (workspace: Workspace | null) => void;
  setWorkspaces: (workspaces: Workspace[]) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  activeWorkspace: null,
  workspaces: [],
  setUser: (user) => set({ user }),
  setActiveWorkspace: (workspace) => set({ activeWorkspace: workspace }),
  setWorkspaces: (workspaces) => set({ workspaces }),
}));
