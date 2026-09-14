"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    const { error: signInError } = await getSupabaseBrowserClient().auth.signInWithPassword({ email, password });
    if (signInError) {
      setError(signInError.message);
      setIsSubmitting(false);
      return;
    }

    router.replace("/");
    router.refresh();
  }

  return <main className="login-page"><section className="login-panel"><span className="brand-mark">ADDIS RMS</span><p className="eyebrow">RESTAURANT OPERATIONS</p><h1>Welcome back.</h1><p>Sign in with your staff account to continue to the restaurant workspace.</p><form className="login-form" onSubmit={handleSubmit}><label htmlFor="email">Email<input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label><label htmlFor="password">Password<input id="password" name="password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>{error && <p className="form-error" role="alert">{error}</p>}<button type="submit" disabled={isSubmitting}>{isSubmitting ? "Signing in..." : "Sign in"}</button></form></section></main>;
}
