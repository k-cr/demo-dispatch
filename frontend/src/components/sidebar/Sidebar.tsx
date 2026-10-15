import { useState } from 'react';
import clsx from 'clsx';
import { ClipboardCheck, ListTree, MapPin, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import type { Checklist, DispatchConfig, Location, Project, StandardTask, TaskExecution } from '../../types';
import { useDispatchStore, type SidebarTab } from '../../store/dispatchStore';
import { StandardTaskTree } from './StandardTaskTree';
import { LocationPanel } from './LocationPanel';
import { ChecklistPanel } from './ChecklistPanel';
import { StandardTaskModal } from './StandardTaskModal';
import { ChecklistModal } from './ChecklistModal';

interface Props {
  config: DispatchConfig;
  projects: Project[];
  locations: Location[];
  standardTasks: StandardTask[];
  checklists: Checklist[];
  executions: TaskExecution[];
  now: number;
}

const TABS: { id: SidebarTab; label: string; icon: typeof ListTree }[] = [
  { id: 'tasks', label: 'Tareas', icon: ListTree },
  { id: 'location', label: 'Ubicación', icon: MapPin },
  { id: 'checklists', label: 'Checklists', icon: ClipboardCheck },
];

export function Sidebar(p: Props) {
  const { sidebarOpen, sidebarTab, toggleSidebar, setSidebarTab } = useDispatchStore();
  const [taskModal, setTaskModal] = useState<{ task: StandardTask | null; categoryId?: number } | null>(null);
  const [checklistModal, setChecklistModal] = useState<{ checklist: Checklist | null } | null>(null);

  if (!sidebarOpen)
    return (
      <aside className="flex w-11 shrink-0 flex-col items-center gap-1 border-r border-gray-200 bg-white py-2">
        <button onClick={toggleSidebar} title="Mostrar panel" className="rounded-md p-2 text-gray-500 hover:bg-gray-100">
          <PanelLeftOpen className="h-4 w-4" />
        </button>
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setSidebarTab(t.id)} title={t.label} className="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-primary-700">
            <t.icon className="h-4 w-4" />
          </button>
        ))}
      </aside>
    );

  return (
    <aside className="flex w-[300px] shrink-0 flex-col border-r border-gray-200 bg-white">
      <div className="flex items-center border-b border-gray-200 pr-1">
        <div role="tablist" className="flex flex-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={sidebarTab === t.id}
              onClick={() => setSidebarTab(t.id)}
              className={clsx(
                'flex flex-1 items-center justify-center gap-1.5 border-b-2 px-2 py-2.5 text-[13px] font-medium',
                sidebarTab === t.id ? 'border-primary-700 text-primary-700' : 'border-transparent text-gray-500 hover:text-gray-800',
              )}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </div>
        <button onClick={toggleSidebar} title="Ocultar panel" className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100">
          <PanelLeftClose className="h-4 w-4" />
        </button>
      </div>

      {sidebarTab === 'tasks' && (
        <StandardTaskTree config={p.config} tasks={p.standardTasks} executions={p.executions} onEdit={(task, categoryId) => setTaskModal({ task, categoryId })} />
      )}
      {sidebarTab === 'location' && <LocationPanel projects={p.projects} locations={p.locations} executions={p.executions} now={p.now} />}
      {sidebarTab === 'checklists' && <ChecklistPanel checklists={p.checklists} onEdit={(checklist) => setChecklistModal({ checklist })} />}

      <StandardTaskModal
        open={!!taskModal}
        task={taskModal?.task ?? null}
        defaultCategoryId={taskModal?.categoryId}
        config={p.config}
        checklists={p.checklists}
        onClose={() => setTaskModal(null)}
      />
      <ChecklistModal
        open={!!checklistModal}
        checklist={checklistModal?.checklist ?? null}
        config={p.config}
        standardTasks={p.standardTasks}
        onClose={() => setChecklistModal(null)}
      />
    </aside>
  );
}
