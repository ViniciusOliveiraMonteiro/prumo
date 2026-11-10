import type { components } from "../api/generated";
import type { ReadApiClient } from "../api/client";

type Household = components["schemas"]["HouseholdResponse"];
type Account = components["schemas"]["AccountResponse"];
type Balance = components["schemas"]["BalanceResponse"];

export type AccountWithBalance = { account: Account; balance: Balance | null };
export type FinanceRead =
  | { kind: "signed-out" }
  | { kind: "error" }
  | {
      kind: "ready";
      households: Household[];
      household: Household | null;
      accounts: AccountWithBalance[];
      date: string | null;
      invalidDate: boolean;
    };

const civilDate = /^\d{4}-\d{2}-\d{2}$/;

function validDate(value: string): boolean {
  if (!civilDate.test(value) || value.startsWith("0000-")) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

async function readFinancesImpl(
  client: ReadApiClient,
  householdId: string | undefined,
  requestedDate: string | undefined,
): Promise<FinanceRead> {
  const householdsResponse = await client.get<Household[]>("/api/households");
  if (householdsResponse.status === 401) return { kind: "signed-out" };
  if (householdsResponse.data === null) return { kind: "error" };

  const households = householdsResponse.data;
  const household = households.find((item) => item.id === householdId) ?? null;
  const invalidDate = requestedDate !== undefined && !validDate(requestedDate);
  const date = requestedDate && !invalidDate ? requestedDate : null;
  if (!household) {
    return {
      kind: "ready",
      households,
      household: null,
      accounts: [],
      date,
      invalidDate,
    };
  }

  const accountsResponse = await client.get<Account[]>(
    `/api/households/${household.id}/accounts`,
  );
  if (accountsResponse.status === 401) return { kind: "signed-out" };
  if (accountsResponse.data === null) return { kind: "error" };
  const accounts = accountsResponse.data;

  if (!date) {
    return {
      kind: "ready",
      households,
      household,
      accounts: accounts.map((account) => ({ account, balance: null })),
      date,
      invalidDate,
    };
  }
  const responses = await Promise.all(
    accounts.map((account) =>
      client.get<Balance>(
        `/api/households/${household.id}/accounts/${account.id}/balance?date=${date}`,
      ),
    ),
  );
  if (responses.some((response) => response.status === 401)) {
    return { kind: "signed-out" };
  }
  if (responses.some((response) => response.data === null))
    return { kind: "error" };
  const balances: AccountWithBalance[] = responses.map((response, index) => ({
    account: accounts[index],
    balance: response.data as Balance,
  }));
  return {
    kind: "ready",
    households,
    household,
    accounts: balances,
    date,
    invalidDate,
  };
}

export async function readFinances(
  client: ReadApiClient,
  householdId: string | undefined,
  requestedDate: string | undefined,
): Promise<FinanceRead> {
  try {
    return await readFinancesImpl(client, householdId, requestedDate);
  } catch {
    return { kind: "error" };
  }
}

export function formatCents(value: string): string {
  const cents = BigInt(value);
  const absolute = cents < BigInt(0) ? -cents : cents;
  const whole = absolute / BigInt(100);
  const remainder = (absolute % BigInt(100)).toString().padStart(2, "0");
  const groups = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${cents < BigInt(0) ? "−" : ""}R$ ${groups},${remainder}`;
}
