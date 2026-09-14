import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

const ROLE_HOME = {
  ADMIN: "/",
  OWNER: "/",
  MANAGER: "/",
  SERVER: "/server",
  CHEF: "/kitchen",
  BARMAN: "/bar",
};

export async function proxy(request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let response = NextResponse.next({ request });

  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;

  if (!user && pathname !== "/login") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (user) {
    const { data: membership } = await supabase
      .from("restaurant_users")
      .select("role")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    const role = membership?.role;
    if (pathname === "/login" && role && ROLE_HOME[role]) {
      return NextResponse.redirect(new URL(ROLE_HOME[role], request.url));
    }

    const rules = [
      { prefixes: ["/admin", "/staff"], roles: ["ADMIN", "OWNER"] },
      { prefixes: ["/menu"], roles: ["ADMIN", "OWNER", "MANAGER"] },
      { prefixes: ["/tables"], roles: ["ADMIN", "OWNER", "MANAGER", "SERVER"] },
      { prefixes: ["/server", "/orders"], roles: ["ADMIN", "OWNER", "MANAGER", "SERVER"] },
      { prefixes: ["/kitchen"], roles: ["ADMIN", "OWNER", "MANAGER", "CHEF"] },
      { prefixes: ["/bar"], roles: ["ADMIN", "OWNER", "MANAGER", "BARMAN"] },
      { prefixes: ["/payments", "/reports"], roles: ["ADMIN", "OWNER", "MANAGER", "SERVER"] },
      { prefixes: ["/inventory"], roles: ["ADMIN", "OWNER", "MANAGER", "CHEF", "BARMAN"] },
    ];

    const rule = rules.find(({ prefixes }) =>
      prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
    );

    if (rule && !rule.roles.includes(role)) {
      return NextResponse.redirect(new URL(ROLE_HOME[role] || "/login", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
