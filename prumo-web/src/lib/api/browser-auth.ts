import type { SignInClient } from "./client";

export const browserSignInClient: SignInClient = {
  async signIn(email, password) {
    const response = await fetch("/api/auth/sign-in", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
    });
    return response.status;
  },
};
