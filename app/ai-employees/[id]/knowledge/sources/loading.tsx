export default function KnowledgeSourcesLoading() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading knowledge sources">
      <div className="h-48 animate-pulse rounded-3xl border border-zinc-800 bg-zinc-900" />
    </div>
  );
}