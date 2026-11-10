import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { once } from "node:events";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { test } from "node:test";

const householdA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const householdB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const accountA = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const accountB = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const webDir = resolve(import.meta.dirname, "..");

async function listen(server) {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return server.address().port;
}

function json(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(body));
}

test("financial HTML isolates sessions, household selectors and cache", async () => {
  const apiRequests = [];
  const revoked = new Set();
  const api = createServer((request, response) => {
    const token = request.headers.cookie?.match(/__Host-sid=([^;]+)/)?.[1];
    const actor =
      token === "session-a" ? "A" : token === "session-b" ? "B" : null;
    const url = new URL(request.url, "http://localhost");
    apiRequests.push({ actor, path: url.pathname });
    if (!actor || revoked.has(actor)) return json(response, 401, {});
    const householdId = actor === "A" ? householdA : householdB;
    const accountId = actor === "A" ? accountA : accountB;
    const accountName = actor === "A" ? "Conta de Alice" : "Conta de Bruno";
    if (url.pathname === "/api/households") {
      return json(response, 200, [
        { id: householdId, name: `Casa ${actor}`, role: "OWNER" },
      ]);
    }
    if (url.pathname === `/api/households/${householdId}/accounts`) {
      return json(response, 200, [
        {
          id: accountId,
          name: accountName,
          currency: "BRL",
          openingDate: "2026-01-01",
          openingBalanceCents: "10000",
          openingVersion: 1,
        },
      ]);
    }
    if (
      url.pathname ===
      `/api/households/${householdId}/accounts/${accountId}/balance`
    ) {
      return json(response, 200, {
        currency: "BRL",
        date: url.searchParams.get("date"),
        openingDate: "2026-01-01",
        openingBalanceCents: "10000",
        calculable: true,
        balanceCents: actor === "A" ? "12345" : "-500",
        negativeBalance: actor === "B",
      });
    }
    return json(response, 404, {});
  });
  const apiPort = await listen(api);
  const portServer = createServer();
  const webPort = await listen(portServer);
  portServer.close();
  await once(portServer, "close");

  const web = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "-p",
      String(webPort),
      "-H",
      "127.0.0.1",
    ],
    {
      cwd: webDir,
      env: {
        ...process.env,
        PRUMO_API_INTERNAL_ORIGIN: `http://127.0.0.1:${apiPort}`,
      },
      stdio: "ignore",
    },
  );
  try {
    let ready = false;
    for (let attempt = 0; attempt < 80; attempt++) {
      if (web.exitCode !== null)
        throw new Error("Next.js exited before readiness");
      try {
        const response = await fetch(`http://127.0.0.1:${webPort}/entrar`);
        if (response.ok) {
          ready = true;
          break;
        }
      } catch {}
      await delay(100);
    }
    assert.equal(ready, true, "Next.js did not become ready");

    async function page(household, cookie) {
      const response = await fetch(
        `http://127.0.0.1:${webPort}/financas?household=${household}&date=2026-02-01`,
        { headers: cookie ? { cookie: `__Host-sid=${cookie}` } : {} },
      );
      assert.equal(response.status, 200);
      assert.match(
        response.headers.get("cache-control") ?? "",
        /private.*no-store/,
      );
      return response.text();
    }

    const alice = await page(householdA, "session-a");
    assert.match(alice, /Conta de Alice/);
    assert.match(alice, /R\$ 123,45/);
    assert.doesNotMatch(alice, /Conta de Bruno/);

    const brunoWithAliceSelector = await page(householdA, "session-b");
    assert.doesNotMatch(brunoWithAliceSelector, /Conta de Alice|R\$ 123,45/);
    assert.match(brunoWithAliceSelector, /Casa B/);
    assert.equal(
      apiRequests.some(
        (request) => request.actor === "B" && request.path.includes(householdA),
      ),
      false,
    );

    const bruno = await page(householdB, "session-b");
    assert.match(bruno, /Conta de Bruno/);
    assert.match(bruno, /−R\$ 5,00/);
    assert.match(bruno, /saldo negativo/);
    assert.doesNotMatch(bruno, /Conta de Alice/);

    const rsc = await fetch(
      `http://127.0.0.1:${webPort}/financas?household=${householdB}&date=2026-02-01&_rsc=sample`,
      { headers: { cookie: "__Host-sid=session-b", RSC: "1" } },
    );
    assert.equal(rsc.status, 200);
    assert.match(rsc.headers.get("cache-control") ?? "", /private.*no-store/);
    const rscBody = await rsc.text();
    assert.match(rscBody, /Conta de Bruno/);
    assert.doesNotMatch(rscBody, /Conta de Alice/);

    const anonymous = await page(householdA);
    assert.match(anonymous, /Entre para ver as contas/);
    assert.doesNotMatch(anonymous, /Conta de Alice|Casa A/);

    revoked.add("A");
    const afterRevocation = await page(householdA, "session-a");
    assert.match(afterRevocation, /Entre para ver as contas/);
    assert.doesNotMatch(afterRevocation, /Conta de Alice|Casa A/);
  } finally {
    web.kill("SIGTERM");
    await Promise.race([once(web, "exit"), delay(3000)]);
    api.close();
    await once(api, "close");
  }
});
