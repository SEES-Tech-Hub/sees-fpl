import Link from "next/link";
import type { Metadata } from "next";
import { SeesMark } from "@/components/brand/sees-mark";

// Privacy notice for the SEES Games Hub. Google's sign-in branding check
// needs this page linked from the OAuth consent screen. Keep it accurate:
// if the app starts collecting something new, add it here.

export const metadata: Metadata = {
  title: "Privacy",
  description: "What the SEES Games Hub collects, why, who can see it, and how to have it removed.",
};

const UPDATED = "23 November 2026";

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-8 pb-16 lg:px-6">
      <header className="flex flex-col gap-3">
        <SeesMark className="size-12 text-brand dark:text-brand-light" />
        <p className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">SEES Games 2026</p>
        <h1 className="font-heading text-display font-bold text-brand uppercase dark:text-foreground">Privacy</h1>
        <p className="text-muted-foreground">
          The SEES Games Hub is run by the Society of Electrical &amp; Electronics and Computer Engineering Students (SEES), University of Lagos,
          for SEES Games 2026. This page explains what we collect when you use it, why, and what you can ask us to do with it.
        </p>
        <p className="text-sm text-muted-foreground">Last updated {UPDATED}.</p>
      </header>

      <Section title="The short version">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>You can follow every score, table and result without signing in.</li>
          <li>If you sign in with Google to play SEES Fantasy, we keep your name, email address and profile picture.</li>
          <li>Your fantasy team name and display name appear in public rankings and leagues. Your email never does.</li>
          <li>We don&apos;t sell your data, show ads or track you across other sites.</li>
          <li>You can ask us to delete your account and fantasy team at any time.</li>
        </ul>
      </Section>

      <Section title="What we collect">
        <Item name="Your Google account basics">
          When you sign in with Google we receive your name, email address and profile picture. Google tells you this on its sign-in screen. We
          don&apos;t receive your Google password or anything else from your account.
        </Item>
        <Item name="Your fantasy game">
          Your team name, year group (if you give one), squad, lineups, captain choices, transfers, chips, the mini-leagues you create or join, and
          the points and rankings worked out from them.
        </Item>
        <Item name="Goal alerts (only if you turn them on)">
          If you tap the bell for notifications, your browser gives us a push address for this device and the matches or teams you chose. It
          identifies the device to the browser&apos;s push service, not to us.
        </Item>
        <Item name="Officials and organisers">
          If you&apos;re an official or admin, the events you record (goals, cards, substitutions) and changes you make are saved with your account
          in an audit log, so results can be checked.
        </Item>
        <Item name="On your device">
          A sign-in cookie keeps you signed in. Your browser also stores a few conveniences, like an unsaved squad draft, the filters you picked and
          the last tab you viewed. These stay on your device and you can clear them in your browser settings.
        </Item>
      </Section>

      <Section title="What is public">
        Scores, fixtures, results, tables, player names and the players&apos; statistics are public, as for any sports event. For fantasy players,
        your display name, team name, year group, points and rank are shown in rankings and to the members of your leagues. Your squad for a
        matchday is visible to others only after that matchday&apos;s deadline has passed.
      </Section>

      <Section title="Why we use it">
        To run the live scores and SEES Fantasy: signing you in, saving your team, working out points and rankings, sending the alerts you asked
        for, and keeping results accurate. We use nothing for advertising.
      </Section>

      <Section title="Who handles it for us">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <strong>Supabase</strong> stores the data and handles sign-in.
          </li>
          <li>
            <strong>Vercel</strong> hosts the website.
          </li>
          <li>
            <strong>Google</strong> provides the sign-in.
          </li>
          <li>
            Your browser&apos;s push service (for example Google or Apple) delivers the alerts you turned on.
          </li>
        </ul>
      </Section>

      <Section title="How long we keep it">
        For SEES Games 2026 and a short time after, so results and rankings can be checked. After that we delete or anonymise fantasy and account
        data. Alerts stop as soon as you turn them off or the browser revokes them.
      </Section>

      <Section title="Your choices">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Use the scores and tables without signing in.</li>
          <li>Turn goal alerts off from the bell on any match, or in your browser&apos;s site settings.</li>
          <li>Ask us to see, correct or delete your data, including your account and fantasy team.</li>
        </ul>
        <p className="mt-3">
          For any of these, contact the SEES Games organisers through the SEES executive team. We&apos;ll respond as soon as we can.
        </p>
      </Section>

      <p className="text-sm text-muted-foreground">
        <Link href="/" className="font-semibold text-primary underline-offset-4 hover:underline">
          Back to the scores
        </Link>
      </p>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-heading text-xl font-semibold">{title}</h2>
      <div className="text-[0.9375rem] leading-relaxed text-foreground/90">{children}</div>
    </section>
  );
}

function Item({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <div className="mb-3 last:mb-0">
      <p className="font-semibold">{name}</p>
      <p className="text-foreground/90">{children}</p>
    </div>
  );
}
