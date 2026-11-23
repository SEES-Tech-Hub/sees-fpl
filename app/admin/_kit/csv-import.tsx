"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileUp } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { commitRows } from "@/lib/admin/csv/preview";
import type { ActionResult } from "@/lib/admin/result";
import type { ImportCounts, ImportPreview } from "@/lib/admin/types";
import { cn } from "@/lib/utils";

// Upload a CSV, see every row checked (new, update, unchanged, error), then
// import all or nothing. The import id is made when the dialog opens, so a
// retried import is applied once. Formats: docs/admin-csv-formats.md.

export function CsvImport<T>({
  title,
  columns,
  sampleHref,
  preview,
  commit,
}: {
  title: string;
  columns: string;
  sampleHref?: string;
  preview: (csv: string) => Promise<ActionResult<ImportPreview<T>>>;
  commit: (input: { importId: string; rows: Array<T & { rowNumber: number }> }) => Promise<ActionResult<ImportCounts & Record<string, unknown>>>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [importId, setImportId] = useState("");
  const [result, setResult] = useState<ImportPreview<T> | null>(null);
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  function reset(next: boolean) {
    setOpen(next);
    if (next) {
      setImportId(crypto.randomUUID());
      setResult(null);
    }
  }

  function onFile(file: File | undefined) {
    if (!file) return;
    start(async () => {
      const text = await file.text();
      const res = await preview(text);
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      setResult(res.data);
    });
  }

  function onImport() {
    if (!result) return;
    start(async () => {
      const res = await commit({ importId, rows: commitRows(result) });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      const c = res.data;
      toast.success(
        c.alreadyApplied ? "Already imported." : `Imported: ${c.inserted} new, ${c.updated} updated, ${c.unchanged} unchanged.`,
      );
      setOpen(false);
      router.refresh();
    });
  }

  const tone = { new: "default", update: "secondary", unchanged: "outline", error: "destructive" } as const;

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <FileUp className="size-4" /> Import CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Columns: <code className="text-xs">{columns}</code>.{" "}
            {sampleHref && (
              <a href={sampleHref} className="underline underline-offset-4" download>
                Sample file
              </a>
            )}
          </DialogDescription>
        </DialogHeader>
        <input ref={input} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        <Button variant="secondary" disabled={pending} onClick={() => input.current?.click()}>
          {pending && !result ? "Checking…" : result ? "Choose a different file" : "Choose a CSV file"}
        </Button>

        {result && (
          <div className="flex flex-col gap-3">
            {result.fileErrors.length > 0 && (
              <ul className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {result.fileErrors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            )}
            <p className="flex flex-wrap gap-2 text-sm">
              {(["new", "update", "unchanged", "error"] as const).map((s) => (
                <Badge key={s} variant={tone[s]}>
                  {result.counts[s]} {s}
                </Badge>
              ))}
            </p>
            <ul className="max-h-72 divide-y divide-border overflow-y-auto rounded-md border border-border text-sm">
              {result.rows.map((r) => (
                <li key={r.rowNumber} className={cn("flex flex-col gap-0.5 px-3 py-2", r.status === "error" && "bg-destructive/5")}>
                  <span className="flex items-center gap-2">
                    <span className="w-14 text-xs text-muted-foreground">Row {r.rowNumber}</span>
                    <Badge variant={tone[r.status]}>{r.status}</Badge>
                    <span className="truncate">{r.changes.join(", ")}</span>
                  </span>
                  {[...r.errors, ...r.warnings].map((m) => (
                    <span key={m} className={cn("pl-16 text-xs", r.errors.includes(m) ? "text-destructive" : "text-muted-foreground")}>
                      {m}
                    </span>
                  ))}
                </li>
              ))}
            </ul>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button disabled={!result?.canCommit || pending} onClick={onImport}>
            {pending && result ? "Importing…" : "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
