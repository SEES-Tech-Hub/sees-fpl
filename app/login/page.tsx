import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { safeNextPath } from "@/lib/safe-next";
import { signInWithGoogle } from "./actions";

export const metadata = { title: "Sign in" };

// Owner: Tayo (sign-in and roles).
export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-12">
      <h1 className="font-heading text-3xl font-semibold text-primary">Sign in</h1>
      <p className="text-muted-foreground">Sign in with Google to play SEES Fantasy.</p>
      <Suspense fallback={<SignInButton next="/fantasy" />}>
        <SignInForm searchParams={searchParams} />
      </Suspense>
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
        <p role="alert" className="rounded-lg border border-destructive/40 px-3 py-2 text-sm text-destructive">
          Sign-in didn&apos;t complete. Please try again.
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
      <Button type="submit" size="lg" className="w-full">
        Continue with Google
      </Button>
    </form>
  );
}
