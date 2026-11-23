"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setRole } from "@/lib/admin/actions/officials";
import type { AdminProfile } from "@/lib/admin/queries/officials";
import { PageTitle, useAdminAction } from "../_kit/admin-kit";

export function OfficialsAdmin({ officials, accounts }: { officials: AdminProfile[]; accounts: AdminProfile[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");

  return (
    <div className="flex flex-col gap-6">
      <PageTitle
        title="Officials"
        description="Officials record matches in the console. Give someone the role here, then make them a fixture's console holder on the Fixtures page. Admins can only be added in the database."
      />

      <section className="flex flex-col gap-2">
        <h2 className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">Officials and admins ({officials.length})</h2>
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
          {officials.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted-foreground">No officials yet.</li>}
          {officials.map((p) => (
            <ProfileRow key={p.id} profile={p} />
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">Find someone</h2>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            router.replace(q.trim() ? `/admin/officials?q=${encodeURIComponent(q.trim())}` : "/admin/officials");
          }}
        >
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or email" className="h-10 max-w-sm" />
          <Button type="submit" variant="secondary">
            Search
          </Button>
        </form>
        <p className="text-xs text-muted-foreground">They need to have signed in once. Newest accounts first.</p>
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
          {accounts.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted-foreground">No accounts match.</li>}
          {accounts.map((p) => (
            <ProfileRow key={p.id} profile={p} />
          ))}
        </ul>
      </section>
    </div>
  );
}

function ProfileRow({ profile: p }: { profile: AdminProfile }) {
  const { run, pending } = useAdminAction();
  const name = p.displayName ?? p.email ?? "Account";
  return (
    <li className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-sm">
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{name}</span>
        {p.email && p.displayName && <span className="block truncate text-xs text-muted-foreground">{p.email}</span>}
      </span>
      <Badge variant={p.role === "admin" ? "default" : p.role === "official" ? "secondary" : "outline"}>{p.role}</Badge>
      {p.role === "user" && (
        <Button size="sm" disabled={pending} onClick={() => run(() => setRole({ profileId: p.id, role: "official" }), { success: `${name} is now an official` })}>
          Make official
        </Button>
      )}
      {p.role === "official" && (
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => run(() => setRole({ profileId: p.id, role: "user" }), { success: `${name} is no longer an official` })}
        >
          Remove role
        </Button>
      )}
    </li>
  );
}
