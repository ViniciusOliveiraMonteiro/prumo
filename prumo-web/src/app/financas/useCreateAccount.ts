"use client";

import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import type {
  CreateAccountClient,
  CreateAccountInput,
} from "../../lib/api/client";
import { accountInput } from "../../lib/finance/account-input";

type Attempt = { key: string; input: CreateAccountInput };
type MarkerState = "present" | "absent" | "unavailable";
const markerKey = (householdId: string) =>
  `prumo-account-unconfirmed:${householdId}`;
const markerEvent = "prumo-account-marker";

function subscribeToMarker(callback: () => void): () => void {
  window.addEventListener(markerEvent, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(markerEvent, callback);
    window.removeEventListener("storage", callback);
  };
}

function markerState(householdId: string): MarkerState {
  try {
    return sessionStorage.getItem(markerKey(householdId)) === "1"
      ? "present"
      : "absent";
  } catch {
    return "unavailable";
  }
}

function setMarker(householdId: string): boolean {
  try {
    sessionStorage.setItem(markerKey(householdId), "1");
    window.dispatchEvent(new Event(markerEvent));
    return true;
  } catch {
    return false;
  }
}

function clearMarker(householdId: string): void {
  try {
    sessionStorage.removeItem(markerKey(householdId));
    window.dispatchEvent(new Event(markerEvent));
  } catch {
    // A falha mantém o marcador e bloqueia outra criação até reconciliação.
  }
}

export function useCreateAccount(
  client: CreateAccountClient,
  householdId: string,
) {
  const router = useRouter();
  const active = useRef(true);
  const [name, setName] = useState("");
  const [openingDate, setOpeningDate] = useState("");
  const [openingBalance, setOpeningBalance] = useState("");
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const currentMarker = useSyncExternalStore(
    subscribeToMarker,
    () => markerState(householdId),
    (): MarkerState => "absent",
  );
  const storageUnavailable = currentMarker === "unavailable";
  const reconcileRequired = currentMarker !== "absent" && attempt === null;

  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || conflict || reconcileRequired) return;
    const input = uncertain
      ? attempt?.input
      : accountInput(name, openingDate, openingBalance);
    if (!input) {
      setMessage("Confira o nome, a data e o saldo inicial em reais.");
      return;
    }
    const current =
      uncertain && attempt ? attempt : { key: crypto.randomUUID(), input };
    if (!setMarker(householdId)) {
      setMessage(
        "O navegador não permite preservar esta tentativa. Ative o armazenamento da aba para abrir a conta.",
      );
      return;
    }
    setAttempt(current);
    setPending(true);
    setMessage(null);
    try {
      const status = await client.create(
        householdId,
        current.key,
        current.input,
      );
      if (!active.current) return;
      if (status === 201) {
        setName("");
        setOpeningDate("");
        setOpeningBalance("");
        setAttempt(null);
        setUncertain(false);
        setConflict(false);
        clearMarker(householdId);
        setMessage(
          "Conta criada. O saldo inicial é um marco, não uma receita.",
        );
        router.refresh();
      } else if (status === 401) {
        setAttempt(null);
        setUncertain(false);
        clearMarker(householdId);
        router.push("/entrar");
        router.refresh();
      } else if (status === 400) {
        setAttempt(null);
        setUncertain(false);
        clearMarker(householdId);
        setMessage(
          "Dados inválidos. Confira os campos antes de tentar de novo.",
        );
      } else if (status === 403) {
        setAttempt(null);
        setUncertain(false);
        clearMarker(householdId);
        setMessage("Você não tem permissão para abrir contas neste household.");
      } else if (status === 404) {
        setAttempt(null);
        setUncertain(false);
        clearMarker(householdId);
        setMessage("Este household não está disponível. Atualize a página.");
      } else if (status === 409) {
        setUncertain(true);
        setConflict(true);
        setMessage(
          "Pedido em conflito. Confira a lista antes de iniciar outra conta.",
        );
      } else {
        setUncertain(true);
        setMessage(
          "Não foi possível confirmar a criação. Tente novamente com os mesmos dados ou confira a lista.",
        );
      }
    } catch {
      if (!active.current) return;
      setUncertain(true);
      setMessage(
        "Não foi possível confirmar a criação. Tente novamente com os mesmos dados ou confira a lista.",
      );
    } finally {
      if (active.current) setPending(false);
    }
  }

  function discard() {
    setAttempt(null);
    setUncertain(false);
    setConflict(false);
    setName("");
    setOpeningDate("");
    setOpeningBalance("");
    setMessage("Confira a lista de contas antes de enviar uma nova criação.");
    router.refresh();
  }

  function acknowledgeReconciliation() {
    clearMarker(householdId);
    setMessage(null);
  }

  return {
    name,
    setName,
    openingDate,
    setOpeningDate,
    openingBalance,
    setOpeningBalance,
    pending,
    uncertain,
    conflict,
    reconcileRequired,
    storageUnavailable,
    message: storageUnavailable
      ? "Não foi possível ler o armazenamento da aba. A abertura de conta está bloqueada neste navegador."
      : reconcileRequired
        ? "Uma criação anterior teve resposta incerta. Confira a lista de contas antes de iniciar outra."
        : message,
    submit,
    discard,
    acknowledgeReconciliation,
  };
}
