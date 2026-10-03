import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function redirectToLogin(request, result) {
  const destination = request.nextUrl.clone();
  destination.pathname = "/login";
  destination.search = "";
  destination.hash = "";
  destination.searchParams.set(
    result === "verified" ? "verified" : "authError",
    result === "verified" ? "1" : "verification"
  );
  return NextResponse.redirect(destination, 303);
}

export async function GET(request) {
  const code = request.nextUrl.searchParams.get("code");
  if (!code) return redirectToLogin(request, "error");

  const supabase = await createSupabaseServerClient();

  try {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return redirectToLogin(request, "error");
  } catch {
    return redirectToLogin(request, "error");
  }

  return redirectToLogin(request, "verified");
}