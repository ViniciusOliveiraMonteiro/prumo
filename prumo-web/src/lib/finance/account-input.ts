import type { CreateAccountInput } from "../api/client";

const maxCents = BigInt("9007199254740991");
const decimal = /^-?(?:0|[1-9]\d*|[1-9]\d{0,2}(?:\.\d{3})+)(?:,\d{1,2})?$/;
const civilDate = /^\d{4}-\d{2}-\d{2}$/;

function centsFromBRL(value: string): string | null {
  const trimmed = value.trim();
  if (!decimal.test(trimmed)) return null;
  const negative = trimmed.startsWith("-");
  const unsigned = negative ? trimmed.slice(1) : trimmed;
  const [whole, fraction = ""] = unsigned.replaceAll(".", "").split(",");
  const cents =
    BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0") || "0");
  if (cents > maxCents) return null;
  return (negative ? -cents : cents).toString();
}

function validDate(value: string): boolean {
  if (!civilDate.test(value) || value.startsWith("0000-")) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

export function accountInput(
  name: string,
  openingDate: string,
  openingBalance: string,
): CreateAccountInput | null {
  const normalizedName = name.trim();
  const cents = centsFromBRL(openingBalance);
  if (
    normalizedName.length < 1 ||
    normalizedName.length > 120 ||
    normalizedName.includes("\0") ||
    !validDate(openingDate) ||
    cents === null
  ) {
    return null;
  }
  return {
    name: normalizedName,
    currency: "BRL",
    openingDate,
    openingBalanceCents: cents,
  };
}
