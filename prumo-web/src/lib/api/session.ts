import { cookies } from "next/headers";
import type { ApiResult, ReadApiClient } from "./client";

async function sessionCookie(): Promise<string | null> {
  const value = (await cookies()).get("__Host-sid")?.value;
  return value ? `__Host-sid=${value}` : null;
}

export function serverReadClient(): ReadApiClient {
  return {
    async get<T>(path: string): Promise<ApiResult<T>> {
      const cookie = await sessionCookie();
      if (!cookie) return { status: 401, data: null };
      const apiOrigin =
        process.env.PRUMO_API_INTERNAL_ORIGIN ?? "http://127.0.0.1:3001";
      const response = await fetch(new URL(path, apiOrigin), {
        headers: { cookie },
        cache: "no-store",
      });
      return response.ok
        ? { status: response.status, data: (await response.json()) as T }
        : { status: response.status, data: null };
    },
  };
}
