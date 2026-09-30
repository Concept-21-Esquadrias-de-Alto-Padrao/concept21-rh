export function LoadingState({ label = "Carregando dados..." }: { label?: string }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="animate-pulse space-y-3">
        <div className="h-4 w-44 rounded bg-zinc-200" />
        <div className="grid gap-3 md:grid-cols-3">
          <div className="h-20 rounded bg-zinc-100" />
          <div className="h-20 rounded bg-zinc-100" />
          <div className="h-20 rounded bg-zinc-100" />
        </div>
        <p className="text-sm text-zinc-500">{label}</p>
      </div>
    </div>
  );
}
