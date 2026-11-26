interface PromptInspectorDrawerProps {
  eventId: string | null;
  onClose: () => void;
}

export function PromptInspectorDrawer({ eventId, onClose }: PromptInspectorDrawerProps) {
  if (!eventId) return null;

  return (
    <aside className="fixed inset-y-0 right-0 z-20 w-full max-w-xl border-l border-slate-800 bg-[#111827] p-6 shadow-2xl">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-100">Inspector de Prompt</h3>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-100"
        >
          Cerrar
        </button>
      </div>
      <p className="mt-4 font-mono text-xs text-slate-400">Evento: {eventId}</p>
    </aside>
  );
}
