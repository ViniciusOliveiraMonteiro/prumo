"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { SignInClient } from "../../lib/api/client";

export function useSignIn(client: SignInClient) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setMessage(null);
    const form = event.currentTarget;
    const values = new FormData(form);
    try {
      const status = await client.signIn(
        String(values.get("email") ?? ""),
        String(values.get("password") ?? ""),
      );
      if (status === 200) {
        form.reset();
        router.push("/financas");
        router.refresh();
        return;
      }
      setMessage(
        status === 429
          ? "Muitas tentativas. Aguarde antes de tentar novamente."
          : status === 401
            ? "E-mail ou senha inválidos."
            : "Não foi possível entrar agora.",
      );
    } catch {
      setMessage("Não foi possível entrar agora.");
    } finally {
      setPending(false);
    }
  }

  return { pending, message, submit };
}
