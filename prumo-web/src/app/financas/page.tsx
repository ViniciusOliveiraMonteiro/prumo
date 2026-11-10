import Link from "next/link";
import { formatCents, readFinances } from "../../lib/finance/read-finances";
import { serverReadClient } from "../../lib/api/session";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ household?: string; date?: string }>;
};

export default async function FinancePage({ searchParams }: Props) {
  const params = await searchParams;
  const data = await readFinances(
    serverReadClient(),
    params.household,
    params.date,
  );

  if (data.kind === "signed-out") {
    return (
      <main className="finance-page">
        <h1>Finanças</h1>
        <p>Entre para ver as contas do seu household.</p>
        <Link href="/entrar">Entrar</Link>
      </main>
    );
  }
  if (data.kind === "error") {
    return (
      <main className="finance-page">
        <h1>Finanças</h1>
        <p>Não foi possível consultar suas contas agora.</p>
      </main>
    );
  }

  return (
    <main className="finance-page">
      <header className="finance-header">
        <div>
          <span className="eyebrow">Prumo</span>
          <h1>Finanças</h1>
        </div>
        <Link href="/conta">Minha conta</Link>
      </header>

      {data.households.length === 0 ? (
        <p>Você ainda não participa de um household.</p>
      ) : (
        <>
          <nav aria-label="Households" className="household-list">
            {data.households.map((household) => (
              <Link
                key={household.id}
                href={`/financas?household=${encodeURIComponent(household.id)}`}
                aria-current={
                  data.household?.id === household.id ? "page" : undefined
                }
              >
                {household.name}
              </Link>
            ))}
          </nav>
          {data.household ? (
            <section aria-labelledby="accounts-title">
              <h2 id="accounts-title">Contas de {data.household.name}</h2>
              <form action="/financas" method="get" className="date-form">
                <input
                  type="hidden"
                  name="household"
                  value={data.household.id}
                />
                <label htmlFor="balance-date">Saldo em</label>
                <input
                  id="balance-date"
                  name="date"
                  type="date"
                  defaultValue={data.date ?? ""}
                  required
                />
                <button type="submit">Consultar</button>
              </form>
              {data.invalidDate && <p role="alert">Informe uma data válida.</p>}
              {data.accounts.length === 0 ? (
                <p>Este household ainda não tem contas.</p>
              ) : (
                <ul className="account-list">
                  {data.accounts.map(({ account, balance }) => (
                    <li key={account.id}>
                      <div>
                        <strong>{account.name}</strong>
                        <small>Marco: {account.openingDate}</small>
                      </div>
                      {balance ? (
                        balance.calculable && balance.balanceCents !== null ? (
                          <span>
                            {formatCents(balance.balanceCents)}
                            {balance.negativeBalance && " · saldo negativo"}
                          </span>
                        ) : (
                          <span>Saldo não calculável antes do marco</span>
                        )
                      ) : (
                        <span>Selecione uma data para consultar o saldo.</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : (
            <p>Selecione um household para ver as contas.</p>
          )}
        </>
      )}
    </main>
  );
}
