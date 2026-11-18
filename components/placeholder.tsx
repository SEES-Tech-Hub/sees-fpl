// Temporary stand-in for routes that haven't been built yet. Delete it when
// the last placeholder page is replaced.
export function Placeholder({ title, owner, notes }: { title: string; owner: string; notes: string }) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-3 px-4 py-12">
      <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Owner: {owner}</p>
      <h1 className="font-heading text-3xl font-semibold text-brand">{title}</h1>
      <p className="text-muted-foreground">{notes}</p>
    </main>
  );
}
