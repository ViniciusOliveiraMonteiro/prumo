"use client";

import { browserCreateAccountClient } from "../../lib/api/browser-finance";
import { useCreateAccount } from "./useCreateAccount";

export function AccountCreateForm({ householdId }: { householdId: string }) {
  const form = useCreateAccount(browserCreateAccountClient, householdId);
  const locked = form.pending || form.uncertain || form.reconcileRequired;

  return (
    <section aria-labelledby="create-account-title" className="create-account">
      <h2 id="create-account-title">Abrir conta</h2>
      <p>
        Informe o saldo no início da data escolhida. Esse marco não é uma
        receita.
      </p>
      <form onSubmit={form.submit} className="account-form">
        <label htmlFor="account-name">Nome da conta</label>
        <input
          id="account-name"
          name="name"
          maxLength={120}
          value={form.name}
          onChange={(event) => form.setName(event.target.value)}
          disabled={locked}
          required
        />
        <label htmlFor="opening-date">Data do marco</label>
        <input
          id="opening-date"
          name="openingDate"
          type="date"
          value={form.openingDate}
          onChange={(event) => form.setOpeningDate(event.target.value)}
          disabled={locked}
          required
        />
        <label htmlFor="opening-balance">Saldo inicial (R$)</label>
        <input
          id="opening-balance"
          name="openingBalance"
          type="text"
          inputMode="decimal"
          maxLength={24}
          placeholder="0,00"
          value={form.openingBalance}
          onChange={(event) => form.setOpeningBalance(event.target.value)}
          disabled={locked}
          required
        />
        <small>Use vírgula para centavos; valor negativo é permitido.</small>
        {form.message && <p role="status">{form.message}</p>}
        {!form.conflict && !form.reconcileRequired && (
          <button type="submit" disabled={form.pending}>
            {form.pending
              ? "Enviando…"
              : form.uncertain
                ? "Tentar novamente"
                : "Abrir conta"}
          </button>
        )}
        {form.uncertain && (
          <button
            type="button"
            className="secondary-button"
            onClick={form.discard}
          >
            Descartar tentativa e conferir contas
          </button>
        )}
        {form.reconcileRequired && !form.storageUnavailable && (
          <button
            type="button"
            className="secondary-button"
            onClick={form.acknowledgeReconciliation}
          >
            Conferi a lista de contas
          </button>
        )}
      </form>
    </section>
  );
}
