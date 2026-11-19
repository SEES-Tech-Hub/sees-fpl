import { Suspense } from "react";
import { redirect } from "next/navigation";
import { LoadingPage } from "@/components/fantasy/states";
import { requireSquad } from "@/lib/fantasy/guards";

export const metadata = { title: "Fantasy" };

// /fantasy sends each manager where they need to be: sign in, onboarding,
// squad builder, or their team.
export default function FantasyHome() {
  return (
    <Suspense fallback={<LoadingPage />}>
      <Route />
    </Suspense>
  );
}

async function Route(): Promise<never> {
  await requireSquad("/fantasy");
  redirect("/fantasy/team");
}
