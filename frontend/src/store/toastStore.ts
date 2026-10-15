import { create } from 'zustand';

export type ToastKind = 'success' | 'error' | 'warning' | 'info';
export interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  lines?: string[];
}

interface ToastState {
  toasts: Toast[];
  push: (t: Omit<Toast, 'id'>, ttlMs?: number) => void;
  dismiss: (id: number) => void;
}

let seq = 0;
export const useToasts = create<ToastState>((set, get) => ({
  toasts: [],
  push: (t, ttlMs = 4500) => {
    const id = ++seq;
    set({ toasts: [...get().toasts.slice(-3), { ...t, id }] });
    setTimeout(() => get().dismiss(id), ttlMs);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

export const toast = {
  success: (title: string, lines?: string[]) => useToasts.getState().push({ kind: 'success', title, lines }),
  error: (title: string, lines?: string[]) => useToasts.getState().push({ kind: 'error', title, lines }, 7000),
  warning: (title: string, lines?: string[]) => useToasts.getState().push({ kind: 'warning', title, lines }, 7000),
  info: (title: string, lines?: string[]) => useToasts.getState().push({ kind: 'info', title, lines }),
};
