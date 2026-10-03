"use client";

import { useActionState } from "react";
import { signIn, signUp, type AuthState } from "./actions";

const initial: AuthState = {};

export function LoginForm() {
  const [signInState, signInAction, signingIn] = useActionState(signIn, initial);
  const [signUpState, signUpAction, signingUp] = useActionState(signUp, initial);
  const state = signUpState.error || signUpState.message ? signUpState : signInState;
  const pending = signingIn || signingUp;

  return (
    <form action={signInAction} className="space-y-4">
      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-base" />
      </div>
      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required minLength={8}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-base" />
      </div>
      {state.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      {state.message && <p className="text-sm text-green-700">{state.message}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={pending}
          className="flex-1 rounded-md bg-slate-900 px-4 py-2 text-white disabled:opacity-50">
          {signingIn ? "Signing in…" : "Sign in"}
        </button>
        <button type="submit" formAction={signUpAction} disabled={pending}
          className="rounded-md border border-slate-300 px-4 py-2 disabled:opacity-50">
          {signingUp ? "Creating…" : "Create account"}
        </button>
      </div>
    </form>
  );
}
