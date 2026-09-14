const defaultState = {
  focus: "",
  focusDone: false,
  todos: [],
  journal: "",
  points: 0,
  prizes: [],
  exchanges: []
};
const difficulties = {
  low: { label: "低", points: 10 },
  medium: { label: "中", points: 30 },
  high: { label: "高", points: 50 }
};
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
let state = { ...defaultState, ...readDay(activeDateKey) };
state.todos = state.todos.map(todo => ({
  ...todo,
  difficulty: difficulties[todo.difficulty] ? todo.difficulty : "low",
  rewarded: todo.rewarded ?? Boolean(todo.done)
}));
let rewards = store ? store.getRewards() : { points: 0, prizes: [], exchanges: [] };
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
      if (todo.done && !todo.rewarded) {
        rewards.points += difficulties[todo.difficulty].points;
        todo.rewarded = true;
        document.querySelector("#reward-status").textContent = `${difficulties[todo.difficulty].points}ポイント獲得しました。`;
        if (store) rewards = store.saveRewards(rewards);
      }
      saveState();
      renderTodos();
      renderRewards();
    });
    const label = document.createElement("label");
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
  const difficulty = document.querySelector('input[name="difficulty"]:checked')?.value || "low";
  state.todos.push({ id, text: value, done: false, difficulty, rewarded: false });
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

function createId(prefix) {
  return window.crypto && typeof window.crypto.randomUUID === "function"
    ? window.crypto.randomUUID()
    : `${prefix}-${Date.now()}`;
}

document.querySelector("#prize-form").addEventListener("submit", event => {
  event.preventDefault();
  const name = document.querySelector("#prize-name").value.trim();
  const cost = Number(document.querySelector("#prize-cost").value);
  if (!name || !Number.isSafeInteger(cost) || cost < 1) return;
  rewards.prizes.push({ id: createId("prize"), name, cost });
  saveRewards();
  event.target.reset();
  renderRewards();
});

const rewardQuantities = new Map();
let rewardHistoryUsed = false;
let rewardEditingId = null;
let rewardDeletingId = null;

function renderRewards() {
  document.querySelector("#point-balance").textContent = `${rewards.points.toLocaleString()} pt`;
  const list = document.querySelector("#prize-list");
  list.replaceChildren();
  document.querySelector("#prize-empty").hidden = rewards.prizes.length > 0;
  rewards.prizes.slice().sort((a, b) => a.cost - b.cost).forEach(prize => {
    let quantity = rewardQuantities.get(prize.id) || 0;
    const card = document.createElement("article");
    const tone = prize.cost < 100 ? "mint" : prize.cost < 500 ? "sky" : prize.cost < 1000 ? "lavender" : "gold";
    card.className = `panel prize-card prize-tone-${tone}`;
    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "prize-edit-button";
    edit.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m16 3 5 5L9 20l-6 1 1-6L16 3Z"/><path d="m13 6 5 5"/></svg>';
    edit.title = "プライズを編集";
    edit.setAttribute("aria-label", `${prize.name}を編集`);
    edit.addEventListener("click", () => {
      rewardEditingId = prize.id;
      document.querySelector("#prize-edit-name").value = prize.name;
      document.querySelector("#prize-edit-cost").value = prize.cost;
      document.querySelector("#prize-edit-dialog").showModal();
    });
    const title = document.createElement("h3");
    title.textContent = prize.name;
    const cost = document.createElement("p");
    cost.textContent = `${prize.cost.toLocaleString()} pt`;
    const priceRow = document.createElement("div");
    priceRow.className = "prize-price-row";
    const stepper = document.createElement("div");
    stepper.className = "quantity-stepper";
    const minus = document.createElement("button");
    const count = document.createElement("output");
    const plus = document.createElement("button");
    minus.type = plus.type = "button";
    minus.textContent = "−";
    plus.textContent = "+";
    minus.setAttribute("aria-label", `${prize.name}の個数を減らす`);
    plus.setAttribute("aria-label", `${prize.name}の個数を増やす`);
    const updateQuantity = () => {
      rewardQuantities.set(prize.id, quantity);
      count.textContent = String(quantity);
      card.classList.toggle("prize-selected", quantity > 0);
      minus.disabled = quantity <= 0;
      plus.disabled = quantity >= 99;
      updateRewardCart();
    };
    minus.addEventListener("click", () => { quantity = Math.max(0, quantity - 1); updateQuantity(); });
    plus.addEventListener("click", () => { quantity = Math.min(99, quantity + 1); updateQuantity(); });
    stepper.append(minus, count, plus);
    priceRow.append(cost, stepper);
    card.append(edit, title, priceRow);
    list.append(card);
    updateQuantity();
  });
  const visible = rewards.exchanges.filter(exchange => Boolean(exchange.used) === rewardHistoryUsed);
  document.querySelector("#history-unused").textContent = `未使用（${rewards.exchanges.filter(exchange => !exchange.used).length}個）`;
  document.querySelector("#history-used").textContent = `使用済み（${rewards.exchanges.filter(exchange => exchange.used).length}個）`;
  document.querySelector("#history-unused").setAttribute("aria-pressed", String(!rewardHistoryUsed));
  document.querySelector("#history-used").setAttribute("aria-pressed", String(rewardHistoryUsed));
  const history = document.querySelector("#prize-history");
  history.replaceChildren();
  document.querySelector("#history-empty").hidden = visible.length > 0;
  visible.forEach(exchange => {
    const item = document.createElement("li");
    item.className = `exchange-item ${exchange.used ? "exchange-used" : "exchange-unused"}`;
    const details = document.createElement("div");
    details.className = "exchange-details";
    const badge = document.createElement("strong");
    badge.className = "exchange-badge";
    badge.textContent = exchange.used ? "✓ 使用済み" : "未使用";
    const label = document.createElement("span");
    label.textContent = exchange.name;
    const meta = document.createElement("small");
    meta.textContent = `1個 ${exchange.cost.toLocaleString()} pt · ${new Date(exchange.date).toLocaleDateString("ja-JP")}`;
    const button = document.createElement("button");
    button.type = "button";
    button.className = exchange.used ? "button button-outline" : "button button-dark";
    button.textContent = exchange.used ? "1個を未使用に戻す" : "1個使う";
    button.addEventListener("click", () => { exchange.used = !exchange.used; saveRewards(); renderRewards(); });
    details.append(badge, label, meta);
    item.append(details, button);
    history.append(item);
  });
  updateRewardCart();
  updateRewardVisibility();
}

let showAllRewards = false;
let showAllRewardHistory = false;

function updateRewardVisibility() {
  const prizeList = document.querySelector("#prize-list");
  const historyList = document.querySelector("#prize-history");
  const prizeButton = document.querySelector("#prizes-show-all");
  const historyButton = document.querySelector("#history-show-all");
  if (!prizeList || !historyList || !prizeButton || !historyButton) return;
  const prizeItems = prizeList.children || [];
  const historyItems = historyList.children || [];
  const prizeLimit = 6;
  const historyLimit = 5;
  Array.from(prizeItems).forEach((item, index) => { item.hidden = !showAllRewards && index >= prizeLimit; });
  Array.from(historyItems).forEach((item, index) => { item.hidden = !showAllRewardHistory && index >= historyLimit; });
  prizeButton.hidden = prizeItems.length <= prizeLimit;
  historyButton.hidden = historyItems.length <= historyLimit;
  prizeButton.textContent = showAllRewards ? "折りたたむ" : `すべて表示（全${prizeItems.length}件）`;
  historyButton.textContent = showAllRewardHistory ? "折りたたむ" : `すべて表示（全${historyItems.length}件）`;
  prizeButton.setAttribute("aria-expanded", String(showAllRewards));
  historyButton.setAttribute("aria-expanded", String(showAllRewardHistory));
}

function updateRewardCart() {
  const selected = rewards.prizes.map(prize => ({ ...prize, quantity: rewardQuantities.get(prize.id) || 0 })).filter(prize => prize.quantity > 0);
  const total = selected.reduce((sum, prize) => sum + prize.cost * prize.quantity, 0);
  const count = selected.reduce((sum, prize) => sum + prize.quantity, 0);
  document.querySelector("#cart-summary").textContent = `${selected.length}種類・${count}個 / 合計 ${total.toLocaleString()} pt`;
  document.querySelector("#cart-checkout").disabled = count === 0 || total > rewards.points;
  return selected;
}

function saveRewards() {
  if (store) rewards = store.saveRewards(rewards);
}

document.querySelector("#cart-checkout").addEventListener("click", () => {
  const selected = updateRewardCart();
  if (!selected.length) return;
  const total = selected.reduce((sum, prize) => sum + prize.cost * prize.quantity, 0);
  if (total > rewards.points) return;
  document.querySelector("#exchange-description").textContent = selected.map(prize => `${prize.name} × ${prize.quantity}`).join("、") + `\n合計 ${total.toLocaleString()} pt`;
  document.querySelector("#exchange-dialog").showModal();
});

document.querySelector("#exchange-dialog").addEventListener("close", event => {
  if (event.target.returnValue !== "confirm") return;
  const selected = updateRewardCart();
  const total = selected.reduce((sum, prize) => sum + prize.cost * prize.quantity, 0);
  if (!selected.length || total > rewards.points) return;
  rewards.points -= total;
  selected.forEach(prize => { for (let index = 0; index < prize.quantity; index += 1) rewards.exchanges.push({ id: createId("exchange"), name: prize.name, cost: prize.cost, date: new Date().toISOString(), used: false }); });
  rewardQuantities.clear();
  saveRewards();
  renderRewards();
});

document.querySelector("#history-unused").addEventListener("click", () => { rewardHistoryUsed = false; renderRewards(); });
document.querySelector("#history-used").addEventListener("click", () => { rewardHistoryUsed = true; renderRewards(); });
document.querySelector("#prizes-show-all").addEventListener("click", () => {
  showAllRewards = !showAllRewards;
  updateRewardVisibility();
});
document.querySelector("#history-show-all").addEventListener("click", () => {
  showAllRewardHistory = !showAllRewardHistory;
  updateRewardVisibility();
});
document.querySelector("#prize-edit-cancel").addEventListener("click", () => document.querySelector("#prize-edit-dialog").close());
document.querySelector("#prize-edit-form").addEventListener("submit", event => {
  event.preventDefault();
  const prize = rewards.prizes.find(item => item.id === rewardEditingId);
  const name = document.querySelector("#prize-edit-name").value.trim();
  const cost = Number(document.querySelector("#prize-edit-cost").value);
  if (!prize || !name || !Number.isSafeInteger(cost) || cost < 1) return;
  prize.name = name;
  prize.cost = cost;
  saveRewards();
  document.querySelector("#prize-edit-dialog").close();
  renderRewards();
});
document.querySelector("#prize-edit-delete").addEventListener("click", () => {
  rewardDeletingId = rewardEditingId;
  document.querySelector("#prize-delete-description").textContent = "このプライズを削除しますか？交換履歴は残ります。";
  document.querySelector("#prize-delete-dialog").showModal();
});
document.querySelector("#prize-delete-dialog").addEventListener("close", event => {
  if (event.target.returnValue !== "delete") return;
  rewards.prizes = rewards.prizes.filter(prize => prize.id !== rewardDeletingId);
  rewardQuantities.delete(rewardDeletingId);
  saveRewards();
  document.querySelector("#prize-edit-dialog").close();
  renderRewards();
});

function showView() {
  const currentHash = typeof location === "undefined" ? "" : location.hash;
  const route = ["#today", "#todos", "#journal", "#prizes"].includes(currentHash) ? currentHash : "#today";
  const dashboard = document.querySelector("#dashboard-view");
  if (dashboard) {
    dashboard.hidden = route === "#prizes";
  } else {
    ["#today", "#todos", "#journal"].forEach(selector => {
      const section = document.querySelector(selector);
      if (section) section.hidden = route === "#prizes";
    });
  }
  document.querySelector("#prizes").hidden = route !== "#prizes";
  const navLinks = typeof document.querySelectorAll === "function" ? document.querySelectorAll(".main-nav a") : [];
  navLinks.forEach(link => {
    link.classList.toggle("active", link.hash === route);
    if (link.hash === route) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  if (route === "#today") {
    if (typeof window.scrollTo === "function") window.scrollTo({ top: 0, behavior: "smooth" });
  } else if (route !== "#prizes" && currentHash) {
    document.querySelector(route).scrollIntoView();
  }
}

document.querySelector('.main-nav a[href="#today"]')?.addEventListener("click", event => {
  event.preventDefault();
  if (location.hash !== "#today") location.hash = "#today";
  if (typeof window.scrollTo === "function") window.scrollTo({ top: 0, behavior: "smooth" });
});

document.querySelector('.main-nav a[href="#prizes"]')?.addEventListener("click", event => {
  event.preventDefault();
  if (location.hash !== "#prizes") location.hash = "#prizes";
  if (typeof window.scrollTo === "function") window.scrollTo({ top: 0, behavior: "smooth" });
});

window.addEventListener("hashchange", showView);
renderRewards();
showView();

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
