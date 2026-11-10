"use client";

import { useSignIn } from "./useSignIn";
import { browserSignInClient } from "../../lib/api/browser-auth";

export function SignInForm() {
  const { pending, message, submit } = useSignIn(browserSignInClient);
  return (
    <form onSubmit={submit} className="sign-in-form">
      <label htmlFor="email">E-mail</label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="username"
        required
      />
      <label htmlFor="password">Senha</label>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
      />
      {message && <p role="alert">{message}</p>}
      <button type="submit" disabled={pending}>
        {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
