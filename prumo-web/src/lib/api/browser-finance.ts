import type { CreateAccountClient } from "./client";

export const browserCreateAccountClient: CreateAccountClient = {
  async create(householdId, key, input) {
    const response = await fetch(
      `/api/households/${encodeURIComponent(householdId)}/accounts`,
      {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": key,
        },
        body: JSON.stringify(input),
        cache: "no-store",
      },
    );
    return response.status;
  },
};
