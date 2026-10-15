import { create } from 'zustand';
import type { ExecutionDraft, ExecutionStatus, RangeMode, TimelineFilters, ZoomLevel } from '../types';

export type SidebarTab = 'tasks' | 'location' | 'checklists';

const EMPTY_FILTERS: TimelineFilters = {
  locationId: null,
  equipmentId: null,
  equipmentTypeId: null,
  operatorId: null,
  standardTaskId: null,
  categoryId: null,
  statuses: [],
};

const RANGE_ZOOM: Record<RangeMode, ZoomLevel> = { shift: 'hours', day: 'day', week: 'week', '2weeks': 'week', '4weeks': 'week' };

interface DispatchState {
  projectId: number | null;
  date: string;
  range: RangeMode;
  shiftId: number | null;
  zoom: ZoomLevel;
  colorBy: 'status' | 'category';
  filters: TimelineFilters;
  selectedId: number | null;
  draft: ExecutionDraft | null;
  sidebarOpen: boolean;
  sidebarTab: SidebarTab;
  collapsedGroups: Record<string, boolean>;
  scrollToNowTick: number;

  setProject: (id: number | null) => void;
  setPeriod: (p: { date?: string; range?: RangeMode; shiftId?: number | null }) => void;
  setZoom: (z: ZoomLevel) => void;
  setColorBy: (c: 'status' | 'category') => void;
  setFilter: <K extends keyof TimelineFilters>(key: K, value: TimelineFilters[K]) => void;
  toggleStatus: (s: ExecutionStatus) => void;
  clearFilters: () => void;
  select: (id: number | null) => void;
  openDraft: (d: ExecutionDraft) => void;
  closeDetail: () => void;
  toggleSidebar: () => void;
  setSidebarTab: (t: SidebarTab) => void;
  toggleGroup: (key: string) => void;
  requestScrollToNow: () => void;
}

export const useDispatchStore = create<DispatchState>((set) => ({
  projectId: null,
  date: '',
  range: 'shift',
  shiftId: null,
  zoom: 'hours',
  colorBy: 'status',
  filters: EMPTY_FILTERS,
  selectedId: null,
  draft: null,
  sidebarOpen: true,
  sidebarTab: 'tasks',
  collapsedGroups: {},
  scrollToNowTick: 0,

  setProject: (projectId) => set({ projectId, filters: { ...EMPTY_FILTERS, statuses: [] }, selectedId: null, draft: null }),
  setPeriod: (p) =>
    set((s) => {
      const range = p.range ?? s.range;
      return {
        date: p.date ?? s.date,
        range,
        shiftId: p.shiftId !== undefined ? p.shiftId : s.shiftId,
        // Al cambiar de rango se ajusta el zoom recomendado
        zoom: p.range && p.range !== s.range ? RANGE_ZOOM[range] : s.zoom,
      };
    }),
  setZoom: (zoom) => set({ zoom }),
  setColorBy: (colorBy) => set({ colorBy }),
  setFilter: (key, value) => set((s) => ({ filters: { ...s.filters, [key]: value } })),
  toggleStatus: (st) =>
    set((s) => ({
      filters: {
        ...s.filters,
        statuses: s.filters.statuses.includes(st) ? s.filters.statuses.filter((x) => x !== st) : [...s.filters.statuses, st],
      },
    })),
  clearFilters: () => set({ filters: { ...EMPTY_FILTERS, statuses: [] } }),
  select: (selectedId) => set({ selectedId, draft: null }),
  openDraft: (draft) => set({ draft, selectedId: null }),
  closeDetail: () => set({ selectedId: null, draft: null }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarTab: (sidebarTab) => set({ sidebarTab, sidebarOpen: true }),
  toggleGroup: (key) => set((s) => ({ collapsedGroups: { ...s.collapsedGroups, [key]: !s.collapsedGroups[key] } })),
  requestScrollToNow: () => set((s) => ({ scrollToNowTick: s.scrollToNowTick + 1 })),
}));

export const activeFilterCount = (f: TimelineFilters) =>
  Object.entries(f).filter(([, v]) => (Array.isArray(v) ? v.length > 0 : v != null)).length;
