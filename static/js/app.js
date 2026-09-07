const STORAGE_KEY = "steplog:v1";
const defaultState = { focus: "", focusDone: false, todos: [], journal: "" };

function loadState() {
  try {
    return { ...defaultState, ...JSON.parse(localStorage.getItem(STORAGE_KEY)) };
  } catch {
    return { ...defaultState };
  }
}

let state = loadState();
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

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function setDate() {
  const today = new Date();
  document.querySelector("#month-label").textContent = `${today.getMonth() + 1}月`;
  document.querySelector("#day-label").textContent = today.getDate();
  document.querySelector("#weekday-label").textContent = new Intl.DateTimeFormat("ja-JP", { weekday: "long" }).format(today);
  document.querySelector("#today-label").textContent = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric" }).format(today).toUpperCase();
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
  state.todos.push({ id: crypto.randomUUID(), text: value, done: false });
  todoInput.value = "";
  saveState();
  renderTodos();
});

journalInput.addEventListener("input", () => {
  updateJournalCount();
  saveStatus.textContent = "未保存";
  saveStatus.classList.remove("saved");
});

document.querySelector("#journal-save").addEventListener("click", () => {
  state.journal = journalInput.value.trim();
  saveState();
  saveStatus.textContent = state.journal ? "保存済み" : "未入力";
  saveStatus.classList.toggle("saved", Boolean(state.journal));
});

document.querySelector("#advice-button").addEventListener("click", () => {
  const note = document.querySelector("#advice-note");
  note.textContent = "AI APIを接続すると、ここにアドバイスが表示されます。";
});

setDate();
renderFocus();
renderTodos();
journalInput.value = state.journal;
saveStatus.textContent = state.journal ? "保存済み" : "未入力";
saveStatus.classList.toggle("saved", Boolean(state.journal));
updateJournalCount();
