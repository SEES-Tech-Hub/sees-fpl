import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Countdown } from "@/components/ui/shared/CountDown";
import { getMatchdayState, getMyTeam, getOptionalFantasyUser, getPlayers } from "@/lib/fantasy/api";

// The fantasy stub on Home's next-match ticket: personal, with the deadline.
//   signed out        → "Pick your fantasy 15"
//   no team yet       → "Your team isn't picked yet"
//   team set          → "Your team is set · Captain <name>"
// After the last deadline it shows the points link, or nothing without a team.
// Reads the signed-in user: Home renders it inside its own <Suspense>.

export async function FantasyTicketStub() {
  const [md, user] = await Promise.all([getMatchdayState(), getOptionalFantasyUser()]);
  const team = user ? await getMyTeam(user) : null;
  const next = md.next;

  if (!next?.deadlineAt) {
    if (!team) return null;
    return <Stub href="/fantasy/points" title="See how your team scored" />;
  }

  let title = "Pick your fantasy 15";
  let href = "/fantasy";
  if (user && !team) {
    title = "Your team isn’t picked yet";
    href = "/fantasy/squad";
  } else if (team) {
    const captainId = team.picks.find((p) => p.isCaptain)?.playerId;
    const captain = captainId ? (await getPlayers()).find((p) => p.id === captainId)?.displayName : null;
    title = captain ? `Your team is set · Captain ${captain}` : "Your team is set · pick a captain";
    href = "/fantasy/team";
  }

  return (
    <Stub href={href} title={title}>
      <span className="flex flex-col items-end gap-0.5">
        <Countdown
          targetAt={next.deadlineAt}
          serverOffsetMs={0}
          showDeadlineLabel={false}
          className="text-xl leading-none text-brand-foreground!"
        />
        <span className="text-[0.6875rem] text-brand-foreground/75">to the {next.name} deadline</span>
      </span>
    </Stub>
  );
}

function Stub({ href, title, children }: { href: string; title: string; children?: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-5 pt-4 pb-5 transition-colors outline-none hover:bg-brand-foreground/5 focus-visible:bg-brand-foreground/10"
    >
      <span className="flex min-w-0 flex-col gap-0.5 text-left">
        <span className="text-[0.6875rem] font-bold tracking-[0.1em] text-brand-light uppercase">SEES Fantasy</span>
        <span className="flex items-center gap-1 text-[0.9375rem] leading-snug font-semibold">
          <span className="min-w-0">{title}</span>
          {!children && <ChevronRight className="size-4 shrink-0" aria-hidden />}
        </span>
      </span>
      {children}
    </Link>
  );
}
