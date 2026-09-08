const STORAGE_KEY = "steplog:v1";
const defaultState = { focus: "", focusDone: false, todos: [], journal: "", points: 0, prizes: [], exchanges: [] };
const difficulties = { low: { label: "低", points: 10 }, medium: { label: "中", points: 30 }, high: { label: "高", points: 50 } };

function loadState() {
  try {
    return { ...defaultState, ...JSON.parse(localStorage.getItem(STORAGE_KEY)) };
  } catch {
    return { ...defaultState };
  }
}

let state = loadState();
// Previously completed tasks must not earn points again after upgrading.
state.todos = state.todos.map(todo => ({ ...todo, difficulty: difficulties[todo.difficulty] ? todo.difficulty : "low", rewarded: todo.rewarded ?? Boolean(todo.done) }));
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
      if (todo.done && !todo.rewarded) {
        const points = difficulties[todo.difficulty].points;
        state.points += points;
        todo.rewarded = true;
        document.querySelector("#reward-status").textContent = `${points}ポイント獲得しました。`;
      }
      saveState();
      renderTodos();
      renderPrizes();
    });
    const label = document.createElement("label");
    checkbox.id = `todo-${todo.id}`;
    label.htmlFor = checkbox.id;
    label.textContent = `${todo.text}（難易度：${difficulties[todo.difficulty].label}）`;
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
  state.todos.push({ id: crypto.randomUUID(), text: value, done: false, difficulty: document.querySelector('input[name="difficulty"]:checked').value, rewarded: false });
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

function showView() {
  const route = ["#today", "#todos", "#journal", "#prizes"].includes(location.hash) ? location.hash : "#today";
  document.querySelector("#dashboard-view").hidden = route === "#prizes";
  document.querySelector("#prizes").hidden = route !== "#prizes";
  document.querySelectorAll(".main-nav a").forEach(link => {
    link.classList.toggle("active", link.hash === route);
    if (link.hash === route) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  if (route !== "#prizes" && location.hash) document.querySelector(route).scrollIntoView();
  else window.scrollTo(0, 0);
}

const exchangeDialog = document.querySelector("#exchange-dialog");
let pendingPrizeId = null;
const editDialog = document.querySelector("#prize-edit-dialog");
let editingPrizeId = null;

function prizeTone(cost) {
  return cost < 100 ? "mint" : cost < 500 ? "sky" : cost < 1000 ? "lavender" : "gold";
}

function renderPrizes() {
  document.querySelector("#point-balance").textContent = `${state.points.toLocaleString()} pt`;
  document.querySelector("#prize-empty").hidden = state.prizes.length > 0;
  const list = document.querySelector("#prize-list");
  list.replaceChildren();
  state.prizes.slice().sort((a, b) => a.cost - b.cost).forEach(prize => {
    const card = document.createElement("article");
    card.className = `panel prize-card prize-tone-${prizeTone(prize.cost)}`;
    const title = document.createElement("h3");
    title.textContent = prize.name;
    const cost = document.createElement("p");
    cost.textContent = `${prize.cost.toLocaleString()} pt`;
    const button = document.createElement("button");
    button.className = "button button-dark";
    button.type = "button";
    button.disabled = state.points < prize.cost;
    button.textContent = button.disabled ? `あと${(prize.cost - state.points).toLocaleString()} pt` : "交換する";
    button.addEventListener("click", () => {
      pendingPrizeId = prize.id;
      exchangeDialog.returnValue = "";
      document.querySelector("#exchange-description").textContent = `${prize.name}と${prize.cost} ptで交換します。交換後の残高は${state.points - prize.cost} ptです。`;
      exchangeDialog.showModal();
    });
    const edit = document.createElement("button");
    edit.className = "button button-outline";
    edit.type = "button";
    edit.textContent = "編集";
    edit.setAttribute("aria-label", `${prize.name}を編集`);
    edit.addEventListener("click", () => {
      editingPrizeId = prize.id;
      document.querySelector("#prize-edit-name").value = prize.name;
      document.querySelector("#prize-edit-cost").value = prize.cost;
      editDialog.showModal();
    });
    const actions = document.createElement("div");
    actions.className = "prize-actions";
    actions.append(button, edit);
    card.append(title, cost, actions);
    list.append(card);
  });
  const history = document.querySelector("#prize-history");
  history.replaceChildren();
  document.querySelector("#history-empty").hidden = state.exchanges.length > 0;
  state.exchanges.slice().reverse().sort((a, b) => Number(a.used) - Number(b.used)).forEach(exchange => {
    const item = document.createElement("li");
    item.className = `exchange-item ${exchange.used ? "exchange-used" : "exchange-unused"}`;
    const details = document.createElement("div");
    details.className = "exchange-details";
    const badge = document.createElement("strong");
    badge.className = "exchange-badge";
    badge.textContent = exchange.used ? "✓ 使用済み" : "未使用 · これから楽しめる";
    const name = document.createElement("span");
    name.textContent = `${exchange.name} · ${exchange.cost} pt · ${new Date(exchange.date).toLocaleDateString("ja-JP")}`;
    const button = document.createElement("button");
    button.className = "button button-dark";
    button.type = "button";
    button.textContent = exchange.used ? "使用済み" : "使った";
    button.disabled = exchange.used;
    button.addEventListener("click", () => { exchange.used = true; saveState(); renderPrizes(); });
    details.append(badge, name);
    item.append(details);
    if (!exchange.used) item.append(button);
    history.append(item);
  });
}

document.querySelector("#prize-form").addEventListener("submit", event => {
  event.preventDefault();
  const name = document.querySelector("#prize-name").value.trim();
  const cost = Number(document.querySelector("#prize-cost").value);
  if (!name || !Number.isSafeInteger(cost) || cost < 1 || cost > 1000000) return;
  state.prizes.push({ id: crypto.randomUUID(), name, cost });
  saveState();
  event.target.reset();
  renderPrizes();
});

document.querySelector("#prize-edit-cancel").addEventListener("click", () => editDialog.close());
editDialog.addEventListener("close", () => { editingPrizeId = null; });
document.querySelector("#prize-edit-form").addEventListener("submit", event => {
  event.preventDefault();
  const prize = state.prizes.find(item => item.id === editingPrizeId);
  const name = document.querySelector("#prize-edit-name").value.trim();
  const cost = Number(document.querySelector("#prize-edit-cost").value);
  if (!prize || !name || name.length > 80 || !Number.isSafeInteger(cost) || cost < 1 || cost > 1000000) return;
  prize.name = name;
  prize.cost = cost;
  saveState();
  editDialog.close();
  renderPrizes();
  document.querySelector("#reward-status").textContent = `${name}を更新しました。`;
});

exchangeDialog.addEventListener("close", () => {
  const prize = state.prizes.find(item => item.id === pendingPrizeId);
  pendingPrizeId = null;
  if (exchangeDialog.returnValue !== "confirm" || !prize || state.points < prize.cost) return;
  state.points -= prize.cost;
  state.exchanges.push({ id: crypto.randomUUID(), name: prize.name, cost: prize.cost, date: new Date().toISOString(), used: false });
  saveState();
  renderPrizes();
  document.querySelector("#reward-status").textContent = `${prize.name}と交換しました。`;
});

window.addEventListener("hashchange", showView);
renderPrizes();
showView();
