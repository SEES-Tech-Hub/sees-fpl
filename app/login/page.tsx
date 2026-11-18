import { Button } from "@/components/ui/button";
import { signInWithGoogle } from "./actions";

export const metadata = { title: "Sign in" };

// Owner: Tayo (sign-in and roles).
export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-12">
      <h1 className="font-heading text-3xl font-semibold text-primary">Sign in</h1>
      <p className="text-muted-foreground">Sign in with Google to play SEES Fantasy.</p>
      <form action={signInWithGoogle}>
        <Button type="submit" size="lg" className="w-full">
          Continue with Google
        </Button>
      </form>
    </main>
  );
}
