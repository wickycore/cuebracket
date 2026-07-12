"use client";

export type TableStatus = "available" | "playing" | "reserved";

export interface PoolTable {
  id: string;
  name: string;
  status: TableStatus;
  tournamentId?: string;
  matchId?: string;
  note?: string;
}

const STORAGE_KEY = "cuebracket:tables:v1";

function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function getTables(): PoolTable[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PoolTable[]) : [];
  } catch {
    return [];
  }
}

export function saveTables(tables: PoolTable[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tables));
  window.dispatchEvent(new Event("cuebracket:tables-changed"));
}

export function addTable(name?: string) {
  const tables = getTables();
  const table: PoolTable = {
    id: makeId(),
    name: name?.trim() || `Table ${tables.length + 1}`,
    status: "available",
  };
  saveTables([...tables, table]);
  return table;
}

export function updateTable(id: string, updates: Partial<PoolTable>) {
  const tables = getTables().map((table) =>
    table.id === id ? { ...table, ...updates } : table,
  );
  saveTables(tables);
}

export function removeTable(id: string) {
  saveTables(getTables().filter((table) => table.id !== id));
}

export function subscribeToTables(callback: () => void) {
  if (typeof window === "undefined") return () => undefined;
  const listener = () => callback();
  window.addEventListener("storage", listener);
  window.addEventListener("cuebracket:tables-changed", listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener("cuebracket:tables-changed", listener);
  };
}
