import { Suspense } from "react";
import { redirect } from "next/navigation";
import { JoinForm } from "@/components/fantasy/join-form";
import { LoadingPage, PageHeader } from "@/components/fantasy/states";
import { getFantasyRules, getMyManager, requireFantasyUser } from "@/lib/fantasy/api";
import { formatMoney } from "@/lib/fantasy/format";

export const metadata = { title: "Join SEES Fantasy" };

export default function JoinPage() {
  return (
    <Suspense fallback={<LoadingPage rows={3} />}>
      <Join />
    </Suspense>
  );
}

async function Join() {
  const user = await requireFantasyUser("/fantasy/join");
  const [manager, rules] = await Promise.all([getMyManager(user), getFantasyRules()]);
  if (manager) redirect("/fantasy");

  return (
    <>
      <PageHeader
        caption="Step 1 of 2"
        title="Name your team"
        description={`Next you'll pick ${rules.squadSize} players within ${formatMoney(rules.budgetTenths)}.`}
      />
      <JoinForm
        managerName={user.name}
        defaultYear={user.yearGroup}
        maxLength={rules.teamNameMaxLength}
      />
    </>
  );
}
