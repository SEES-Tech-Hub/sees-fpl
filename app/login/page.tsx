import Link from "next/link";
import { Suspense } from "react";
import { BellRing, ChevronLeft, Shirt, Users } from "lucide-react";
import { YearCrest } from "@/components/brand/year-crest";
import { safeNextPath } from "@/lib/safe-next";
import { signInWithGoogle } from "./actions";
import { privatePage } from "@/lib/seo";

export const metadata = privatePage("Sign in");

// Owner: Tayo (sign-in and roles). "Floodlights": the five crests under the
// stadium lights, why to sign in, and one Google button. Scores never need an
// account, so the corner link goes back to them.

const YEARS = [1, 2, 3, 4, 5];

// Everything comes in once, in order: the lights, the crests, the line, the
// headline, the reasons, then the button. Off for reduced motion.
const ENTER = "motion-safe:animate-in motion-safe:fade-in motion-safe:fill-mode-backwards";
const rise = (ms: number) => ({ animationDelay: `${ms}ms` });

const PERKS = [
  { icon: Shirt, strong: "Pick 15 players", rest: "from all five years, and a captain" },
  { icon: Users, strong: "Private leagues", rest: "to beat your friends" },
  { icon: BellRing, strong: "Your points", rest: "sent to your phone after every matchday" },
];

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="relative isolate flex min-h-dvh flex-1 flex-col overflow-hidden bg-pitch text-brand-foreground">
      {/* Two floodlights from the top corners */}
      <span
        aria-hidden
        className={`pointer-events-none absolute -top-24 -left-24 -z-10 h-96 w-80 -rotate-[20deg] bg-[radial-gradient(closest-side,var(--color-brand-light),transparent)] opacity-25 ${ENTER} motion-safe:slide-in-from-left-10 motion-safe:duration-1000`}
      />
      <span
        aria-hidden
        className={`pointer-events-none absolute -top-24 -right-24 -z-10 h-96 w-80 rotate-[20deg] bg-[radial-gradient(closest-side,var(--color-brand-light),transparent)] opacity-25 ${ENTER} motion-safe:slide-in-from-right-10 motion-safe:duration-1000`}
      />

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 pt-3 pb-8">
        <div className={`flex items-center justify-between ${ENTER} motion-safe:duration-500`}>
          <Link
            href="/"
            className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-brand-foreground/80 transition-colors hover:text-brand-foreground"
          >
            <ChevronLeft className="size-4" aria-hidden /> Scores
          </Link>
          <span className="font-heading text-sm font-bold tracking-[0.12em]">SEES GAMES</span>
          <span className="w-16" aria-hidden />
        </div>

        <div className="mt-10 flex items-end justify-center gap-1.5 sm:gap-3" aria-hidden>
          {YEARS.map((year, i) => (
            <span
              key={year}
              className={`${ENTER} motion-safe:zoom-in-75 motion-safe:slide-in-from-bottom-4 motion-safe:duration-500`}
              style={rise(200 + i * 80)}
            >
              <YearCrest year={year} variant="crest" tone="dark" size={62} label="" />
            </span>
          ))}
        </div>
        <span
          aria-hidden
          className={`mx-8 mt-3 h-px bg-[linear-gradient(90deg,transparent,var(--color-brand-foreground),transparent)] opacity-50 ${ENTER} motion-safe:zoom-in-0 motion-safe:duration-700`}
          style={rise(650)}
        />

        <h1
          className={`mt-9 text-center font-heading text-[2.6rem] leading-none font-bold uppercase ${ENTER} motion-safe:slide-in-from-bottom-4 motion-safe:duration-500`}
          style={rise(750)}
        >
          Your festival.
          <br />
          Your team.
        </h1>
        <p
          className={`mt-3 text-center text-[0.9375rem] leading-relaxed text-brand-foreground/80 ${ENTER} motion-safe:slide-in-from-bottom-3 motion-safe:duration-500`}
          style={rise(850)}
        >
          Sign in once to play SEES Fantasy and make this phone yours.
        </p>

        <ul className="mt-8 flex flex-col gap-4">
          {PERKS.map(({ icon: Icon, strong, rest }, i) => (
            <li
              key={strong}
              className={`grid grid-cols-[2.25rem_1fr] items-center gap-3 text-sm ${ENTER} motion-safe:slide-in-from-left-4 motion-safe:duration-500`}
              style={rise(950 + i * 90)}
            >
              <span className="flex size-9 items-center justify-center rounded-xl bg-brand-light/15 text-brand-light">
                <Icon className="size-[18px]" aria-hidden />
              </span>
              <span>
                <strong className="font-semibold">{strong}</strong> {rest}
              </span>
            </li>
          ))}
        </ul>

        <div className={`mt-auto flex flex-col gap-3 pt-10 ${ENTER} motion-safe:slide-in-from-bottom-6 motion-safe:duration-500`} style={rise(1250)}>
          <Suspense fallback={<SignInButton next="/fantasy" />}>
            <SignInForm searchParams={searchParams} />
          </Suspense>
          <p className="text-center text-xs leading-relaxed text-brand-foreground/75">
            Any Google account works. We only see your name and email.{" "}
            <Link href="/privacy" className="font-semibold text-brand-light underline-offset-4 hover:underline">
              Privacy notice
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

async function SignInForm({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === "string" ? params.next : undefined);
  const failed = params.error === "auth";

  return (
    <>
      {failed && (
        <p role="alert" className="rounded-xl border border-brand-light/30 bg-brand-light/10 px-4 py-3 text-sm">
          That didn&apos;t go through. Try again, or use a different Google account.
        </p>
      )}
      <SignInButton next={next} />
    </>
  );
}

function SignInButton({ next }: { next: string }) {
  return (
    <form action={signInWithGoogle}>
      <input type="hidden" name="next" value={next} />
      <button
        type="submit"
        className="flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-brand-foreground text-base font-semibold text-pitch shadow-raised transition-transform outline-none focus-visible:ring-3 focus-visible:ring-brand-light active:scale-[0.98]"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- a tiny static logo */}
        <img src="/brand/google-g.svg" alt="" width={20} height={20} />
        Continue with Google
      </button>
    </form>
  );
}
