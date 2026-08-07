/** Personal calendar ToDos stored per employee (browser-local). */

export type EmpCalendarTodoItem = {
  id: string;
  text: string;
  done: boolean;
  createdAt: string;
};

type TodoStore = Record<string, EmpCalendarTodoItem[]>;

function storageKey(employeeId: number) {
  return `empCalendarTodos:v1:${employeeId}`;
}

function readStore(employeeId: number): TodoStore {
  if (typeof window === "undefined" || !employeeId) return {};
  try {
    const raw = localStorage.getItem(storageKey(employeeId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(employeeId: number, store: TodoStore) {
  if (typeof window === "undefined" || !employeeId) return;
  try {
    localStorage.setItem(storageKey(employeeId), JSON.stringify(store));
    window.dispatchEvent(new CustomEvent("emp-calendar-todos-changed", { detail: { employeeId } }));
  } catch {
    /* ignore quota */
  }
}

export function listTodosForDate(employeeId: number, dateKey: string): EmpCalendarTodoItem[] {
  const store = readStore(employeeId);
  return Array.isArray(store[dateKey]) ? store[dateKey] : [];
}

export function countTodosByDate(employeeId: number): Map<string, number> {
  const store = readStore(employeeId);
  const map = new Map<string, number>();
  for (const [dateKey, items] of Object.entries(store)) {
    const n = Array.isArray(items) ? items.filter((t) => !t.done).length : 0;
    if (n > 0) map.set(dateKey, n);
  }
  return map;
}

/** Open (incomplete) todo texts keyed by date — for calendar tooltips. */
export function todoTextsByDate(employeeId: number): Map<string, string[]> {
  const store = readStore(employeeId);
  const map = new Map<string, string[]>();
  for (const [dateKey, items] of Object.entries(store)) {
    const texts = Array.isArray(items)
      ? items.filter((t) => !t.done).map((t) => t.text)
      : [];
    if (texts.length > 0) map.set(dateKey, texts);
  }
  return map;
}

export function addTodoForDate(employeeId: number, dateKey: string, text: string): EmpCalendarTodoItem {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("ToDo text is required");
  const store = readStore(employeeId);
  const item: EmpCalendarTodoItem = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text: trimmed,
    done: false,
    createdAt: new Date().toISOString(),
  };
  store[dateKey] = [...(store[dateKey] || []), item];
  writeStore(employeeId, store);
  return item;
}

export function toggleTodoForDate(employeeId: number, dateKey: string, todoId: string) {
  const store = readStore(employeeId);
  const list = store[dateKey] || [];
  store[dateKey] = list.map((t) => (t.id === todoId ? { ...t, done: !t.done } : t));
  writeStore(employeeId, store);
}

export function removeTodoForDate(employeeId: number, dateKey: string, todoId: string) {
  const store = readStore(employeeId);
  store[dateKey] = (store[dateKey] || []).filter((t) => t.id !== todoId);
  if (store[dateKey].length === 0) delete store[dateKey];
  writeStore(employeeId, store);
}
