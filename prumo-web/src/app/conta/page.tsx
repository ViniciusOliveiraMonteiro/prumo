import { cookies } from "next/headers";
import type { components } from "../../lib/api/generated";

type CurrentUser = components["schemas"]["CurrentUserResponse"];

async function currentUser(): Promise<CurrentUser | null> {
  const session = (await cookies()).get("__Host-sid")?.value;
  if (!session) return null;

  const apiOrigin =
    process.env.PRUMO_API_INTERNAL_ORIGIN ?? "http://127.0.0.1:3001";
  const response = await fetch(`${apiOrigin}/api/auth/me`, {
    headers: { cookie: `__Host-sid=${session}` },
    cache: "no-store",
  });

  if (response.status === 401) return null;
  if (!response.ok) throw new Error("Não foi possível consultar a sessão.");
  return (await response.json()) as CurrentUser;
}

export default async function AccountPage() {
  const user = await currentUser();

  return (
    <main className="home">
      <span className="eyebrow">Prumo</span>
      <h1>Conta</h1>
      {user ? (
        <p>Conectado como {user.email}</p>
      ) : (
        <p>Você não está conectado.</p>
      )}
    </main>
  );
}
