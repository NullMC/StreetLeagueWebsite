export function EmptyState({
  title = "Nessun dato disponibile",
  text = "Collega Supabase e popola il database per visualizzare i contenuti.",
}: {
  title?: string;
  text?: string;
}) {
  return (
    <div className="empty-state">
      <div>
        <h3>{title}</h3>
        <p>{text}</p>
      </div>
    </div>
  );
}
