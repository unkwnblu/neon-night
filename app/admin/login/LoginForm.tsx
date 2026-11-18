"use client";

import { useActionState } from "react";
import { login, type LoginState } from "../actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  return (
    <form action={action} className="admin-card admin-stack">
      <label className="admin-field">
        <span>Admin password</span>
        <input type="password" name="password" autoComplete="current-password" required autoFocus />
      </label>
      {state.error && <p className="admin-error" role="alert">{state.error}</p>}
      <button className="admin-btn" disabled={pending}>
        {pending ? "Checking…" : "Sign in"}
      </button>
    </form>
  );
}
