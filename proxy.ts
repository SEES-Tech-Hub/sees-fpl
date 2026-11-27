import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Refreshes the Supabase session cookie on signed-in areas only.
// Authorization is NOT done here: pages, actions and RLS check roles.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );
  // getClaims checks the session token locally against the project's public
  // signing key (ES256), refreshing it when it has expired; getUser asked
  // Supabase over the network on every page, which stalls when it's busy.
  await supabase.auth.getClaims();
  return response;
}

export const config = {
  matcher: ["/fantasy/:path*", "/admin/:path*", "/console/:path*", "/login", "/auth/:path*"],
};
