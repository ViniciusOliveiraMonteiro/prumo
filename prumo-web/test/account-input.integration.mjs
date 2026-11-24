import assert from "node:assert/strict";
import { test } from "node:test";
import { accountInput } from "../src/lib/finance/account-input.ts";

test("account opening balance converts BRL exactly to signed cents", () => {
  const amount = (value) =>
    accountInput("Conta", "2026-01-01", value)?.openingBalanceCents;
  assert.equal(amount("1.234,56"), "123456");
  assert.equal(amount("-0,05"), "-5");
  assert.equal(amount("0"), "0");
  assert.equal(amount("90.071.992.547.409,91"), "9007199254740991");
  assert.equal(amount("90.071.992.547.409,92"), undefined);
  assert.equal(amount("1,234"), undefined);
  assert.equal(amount("1.23,45"), undefined);
});

test("account opening date and name are normalized without guessing a date", () => {
  assert.deepEqual(accountInput(" Conta ", "2026-02-28", "12,3"), {
    name: "Conta",
    currency: "BRL",
    openingDate: "2026-02-28",
    openingBalanceCents: "1230",
  });
  assert.equal(accountInput("Conta", "2026-02-29", "1,00"), null);
  assert.equal(accountInput("Conta", "", "1,00"), null);
  assert.equal(accountInput(" ", "2026-02-28", "1,00"), null);
});
