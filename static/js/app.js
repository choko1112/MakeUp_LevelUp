const defaultState = { focus: "", focusDone: false, todos: [], journal: "" };
const store = window.StepLogStore;

function fallbackDateKey(date = new Date()) {
  const value = date instanceof Date ? date : new Date(date);
  return [value.getFullYear(), String(value.getMonth() + 1).padStart(2, "0"), String(value.getDate()).padStart(2, "0")].join("-");
}

function todayKey() {
  return store ? store.dateKey() : fallbackDateKey();
}

function emptyState() {
  return store ? store.emptyRecord() : { ...defaultState, todos: [] };
}

let dayReadFailed = false;

function readDay(key) {
  try {
    dayReadFailed = false;
    return store ? store.getDay(key) : emptyState();
  } catch {
    dayReadFailed = true;
    return emptyState();
  }
}

let activeDateKey = todayKey();
let lastTodayKey = activeDateKey;
let state = readDay(activeDateKey);
let pendingStates = new Map();
let journalDirty = false;

const focusForm = document.querySelector("#focus-form");
const focusInput = document.querySelector("#focus-input");
const focusResult = document.querySelector("#focus-result");
const focusText = document.querySelector("#focus-text");
const focusCheck = document.querySelector("#focus-check");
const todoForm = document.querySelector("#todo-form");
const todoInput = document.querySelector("#todo-input");
const todoList = document.querySelector("#todo-list");
const todoEmpty = document.querySelector("#todo-empty");
const todoCount = document.querySelector("#todo-count");
const journalInput = document.querySelector("#journal-input");
const saveStatus = document.querySelector("#save-status");

function setSaveStatus(text, saved = false, error = false) {
  saveStatus.textContent = text;
  saveStatus.classList.toggle("saved", saved);
  saveStatus.classList.toggle("save-error", error);
}

function stateWithJournalDraft() {
  return { ...state, todos: state.todos.map((todo) => ({ ...todo })), journal: journalInput.value.trim() };
}

function persistDay(key, record) {
  if (!store) {
    setSaveStatus("保存できません", false, true);
    return false;
  }

  try {
    const saved = store.saveDay(key, record);
    if (key === activeDateKey) {
      state = saved;
      dayReadFailed = false;
    }
    pendingStates.delete(key);
    return true;
  } catch {
    pendingStates.set(key, { ...record, todos: record.todos.map((todo) => ({ ...todo })) });
    setSaveStatus("保存に失敗しました", false, true);
    return false;
  }
}

function saveState({ includeJournal = false } = {}) {
  const nextState = includeJournal ? stateWithJournalDraft() : { ...state, todos: state.todos.map((todo) => ({ ...todo })) };
  const saved = persistDay(activeDateKey, nextState);
  if (saved && includeJournal) {
    journalDirty = false;
    setSaveStatus(nextState.journal ? "保存済み" : "未入力", Boolean(nextState.journal));
  }
  return saved;
}

function dateFromKey(key) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function setDate(key) {
  const date = dateFromKey(key);
  document.querySelector("#month-label").textContent = `${date.getMonth() + 1}月`;
  document.querySelector("#day-label").textContent = date.getDate();
  document.querySelector("#weekday-label").textContent = new Intl.DateTimeFormat("ja-JP", { weekday: "long" }).format(date);
  document.querySelector("#today-label").textContent = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric" }).format(date).toUpperCase();
}

function renderFocus() {
  const hasFocus = Boolean(state.focus);
  focusForm.hidden = hasFocus;
  focusResult.hidden = !hasFocus;
  focusText.textContent = state.focus;
  focusResult.classList.toggle("completed", state.focusDone);
  focusCheck.classList.toggle("done", state.focusDone);
  focusCheck.setAttribute("aria-label", state.focusDone ? "今日の目標を未完了に戻す" : "今日の目標を完了にする");
}

function renderTodos() {
  todoList.replaceChildren();
  state.todos.forEach((todo) => {
    const item = document.createElement("li");
    item.className = `todo-item${todo.done ? " done" : ""}`;
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = todo.done;
    checkbox.setAttribute("aria-label", `${todo.text}を${todo.done ? "未完了" : "完了"}にする`);
    checkbox.addEventListener("change", () => {
      todo.done = checkbox.checked;
      saveState();
      renderTodos();
    });
    const label = document.createElement("label");
    label.textContent = todo.text;
    const remove = document.createElement("button");
    remove.className = "delete-todo";
    remove.type = "button";
    remove.textContent = "×";
    remove.setAttribute("aria-label", `${todo.text}を削除`);
    remove.addEventListener("click", () => {
      state.todos = state.todos.filter((itemTodo) => itemTodo.id !== todo.id);
      saveState();
      renderTodos();
    });
    item.append(checkbox, label, remove);
    todoList.append(item);
  });
  todoEmpty.hidden = state.todos.length > 0;
  const remaining = state.todos.filter((todo) => !todo.done).length;
  todoCount.textContent = `${remaining}件`;
}

function updateJournalCount() {
  document.querySelector("#character-count").textContent = `${journalInput.value.length} / 1000`;
}

function renderDay() {
  setDate(activeDateKey);
  renderFocus();
  renderTodos();
  journalInput.value = state.journal;
  journalDirty = false;
  if (dayReadFailed) setSaveStatus("保存データを読み込めません", false, true);
  else setSaveStatus(state.journal ? "保存済み" : "未入力", Boolean(state.journal));
  updateJournalCount();
}

function setActiveDate(key) {
  if (typeof key !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  if (key === activeDateKey) return true;

  // Commit a journal draft to the day it was written on before changing the view.
  const outgoing = stateWithJournalDraft();
  if (!persistDay(activeDateKey, outgoing)) return false;

  activeDateKey = key;
  state = pendingStates.get(key) || readDay(key);
  renderDay();
  if (pendingStates.has(key)) setSaveStatus("保存に失敗しました", false, true);
  return true;
}

function checkDateRollover() {
  const currentTodayKey = todayKey();
  if (currentTodayKey === lastTodayKey) return;
  const previousTodayKey = lastTodayKey;
  if (activeDateKey === previousTodayKey && !setActiveDate(currentTodayKey)) return;
  lastTodayKey = currentTodayKey;
}

focusForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const value = focusInput.value.trim();
  if (!value) return;
  state.focus = value;
  state.focusDone = false;
  focusInput.value = "";
  saveState();
  renderFocus();
});

focusCheck.addEventListener("click", () => {
  state.focusDone = !state.focusDone;
  saveState();
  renderFocus();
});

document.querySelector("#focus-edit").addEventListener("click", () => {
  const previous = state.focus;
  state.focus = "";
  saveState();
  renderFocus();
  focusInput.value = previous;
  focusInput.focus();
});

todoForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const value = todoInput.value.trim();
  if (!value) return;
  const id = window.crypto && typeof window.crypto.randomUUID === "function" ? window.crypto.randomUUID() : `todo-${Date.now()}`;
  state.todos.push({ id, text: value, done: false });
  todoInput.value = "";
  saveState();
  renderTodos();
});

journalInput.addEventListener("input", () => {
  updateJournalCount();
  journalDirty = journalInput.value.trim() !== state.journal;
  setSaveStatus(journalDirty ? "未保存" : state.journal ? "保存済み" : "未入力", !journalDirty && Boolean(state.journal));
});

document.querySelector("#journal-save").addEventListener("click", () => {
  saveState({ includeJournal: true });
});

document.querySelector("#advice-button").addEventListener("click", () => {
  const note = document.querySelector("#advice-note");
  note.textContent = "AI APIを接続すると、ここにアドバイスが表示されます。";
});

window.StepLogApp = Object.freeze({
  getActiveDateKey: () => activeDateKey,
  setActiveDate,
  checkDateRollover,
});

renderDay();

window.addEventListener("beforeunload", (event) => {
  pendingStates.forEach((pending, key) => persistDay(key, pending));
  if (journalDirty) persistDay(activeDateKey, stateWithJournalDraft());
  if (pendingStates.size) {
    event.preventDefault();
    event.returnValue = "";
  }
});
window.addEventListener("focus", checkDateRollover);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) checkDateRollover();
});

// A short polling interval catches a date change while the page remains open.
const rolloverTimer = window.setInterval(checkDateRollover, 60000);
if (rolloverTimer && typeof rolloverTimer.unref === "function") rolloverTimer.unref();
