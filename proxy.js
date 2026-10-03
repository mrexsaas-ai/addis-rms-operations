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

const PUBLIC_PATHS = new Set(["/login", "/signup", "/staff-login", "/auth/callback"]);

export async function proxy(request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let response = NextResponse.next({
    request,
  });

  function redirectWithCookies(destination) {
    const redirectResponse = NextResponse.redirect(new URL(destination, request.url));
    response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
    return redirectResponse;
  }

  if (!url || !key) {
    return response;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { data: { user }, error } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;

  if (error && !user) {
    if (!PUBLIC_PATHS.has(pathname)) {
      return redirectWithCookies("/login");
    }
  }

  if (!user) {
    if (!PUBLIC_PATHS.has(pathname)) {
      return redirectWithCookies("/login");
    }
    return response;
  }

  const { data: membership } = await supabase
    .from("restaurant_users")
    .select("role, restaurants(status)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(2);

  const memberships = membership || [];
  const ambiguousMembership = memberships.length > 1;
  const selectedMembership = memberships.length === 1 ? memberships[0] : null;

  const role = selectedMembership?.role;
  const restaurant = Array.isArray(selectedMembership?.restaurants)
    ? selectedMembership.restaurants[0]
    : selectedMembership?.restaurants;
  const restaurantInactive = Boolean(selectedMembership && restaurant?.status !== "ACTIVE");
  if (ambiguousMembership && !PUBLIC_PATHS.has(pathname)) {
    return redirectWithCookies("/login?membershipAmbiguous=1");
  }

  if (restaurantInactive && !PUBLIC_PATHS.has(pathname)) {
    return redirectWithCookies("/login?restaurantInactive=1");
  }

  if (!restaurantInactive && pathname === "/login" && role && ROLE_HOME[role]) {
    return redirectWithCookies(ROLE_HOME[role]);
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

  if (rule && (!role || !rule.roles.includes(role))) {
    return redirectWithCookies(ROLE_HOME[role] || "/login");
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
