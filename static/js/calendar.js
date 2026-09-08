(() => {
  const store = window.StepLogStore;
  let selected = new Date();
  let month = new Date(selected.getFullYear(), selected.getMonth(), 1);
  let days = {};
  const $ = (selector) => document.querySelector(selector);
  const hasRecord = (day) => Boolean(day && (day.focus || day.journal || day.todos.length));

  function renderDetails() {
    const key = store.dateKey(selected);
    const day = days[key] || store.emptyRecord();
    $("#selected-date").textContent = new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "long", day: "numeric", weekday: "short" }).format(selected);
    $("#day-empty").hidden = hasRecord(day);
    $("#day-focus").textContent = day.focus || "フォーカスの記録はありません。";
    const status = $("#day-focus-status");
    status.textContent = day.focus ? (day.focusDone ? "達成" : "未達成") : "未設定";
    status.classList.toggle("achieved", Boolean(day.focus && day.focusDone));
    $("#day-todo-count").textContent = `${day.todos.filter((todo) => todo.done).length} / ${day.todos.length}件完了`;
    $("#day-todos-empty").hidden = day.todos.length > 0;
    $("#day-todos").replaceChildren();
    day.todos.forEach((todo) => {
      const item = document.createElement("li");
      const badge = document.createElement("span");
      badge.textContent = todo.done ? "完了" : "未完了";
      badge.className = todo.done ? "todo-status achieved" : "todo-status";
      const text = document.createElement("span");
      text.textContent = todo.text;
      item.append(badge, text);
      $("#day-todos").append(item);
    });
    $("#day-journal").textContent = day.journal || "活動日記の記録はありません。";
    $("#edit-today").hidden = key !== store.dateKey();
  }

  function renderMonth() {
    $("#calendar-month").textContent = `${month.getFullYear()}年 ${month.getMonth() + 1}月`;
    const container = $("#calendar-days");
    container.replaceChildren();
    const start = new Date(month.getFullYear(), month.getMonth(), 1 - month.getDay());
    const today = store.dateKey();
    for (let i = 0; i < 42; i += 1) {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      const key = store.dateKey(date);
      const recorded = hasRecord(days[key]);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "calendar-day";
      button.classList.toggle("outside-month", date.getMonth() !== month.getMonth());
      button.classList.toggle("is-today", key === today);
      button.classList.toggle("has-record", recorded);
      button.dataset.date = key;
      button.setAttribute("aria-pressed", String(key === store.dateKey(selected)));
      button.setAttribute("aria-label", `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日${key === today ? "、今日" : ""}${recorded ? "、記録あり" : ""}`);
      if (key === today) button.setAttribute("aria-current", "date");
      const number = document.createElement("span");
      number.textContent = date.getDate();
      const marker = document.createElement("span");
      marker.className = "day-marker";
      marker.setAttribute("aria-hidden", "true");
      marker.textContent = recorded ? "●" : "";
      button.append(number, marker);
      button.addEventListener("click", () => {
        selected = date;
        month = new Date(date.getFullYear(), date.getMonth(), 1);
        renderMonth();
        renderDetails();
        container.querySelector(`[data-date="${key}"]`)?.focus({ preventScroll: true });
      });
      container.append(button);
    }
  }

  function refresh() {
    try {
      days = store.getDays();
      $("#calendar-error").hidden = true;
      renderMonth();
      renderDetails();
    } catch {
      $("#calendar-error").textContent = "記録を読み込めませんでした。ブラウザーの保存設定を確認し、再読み込みしてください。";
      $("#calendar-error").hidden = false;
    }
  }
  $("#previous-month").addEventListener("click", () => { month.setMonth(month.getMonth() - 1); renderMonth(); });
  $("#next-month").addEventListener("click", () => { month.setMonth(month.getMonth() + 1); renderMonth(); });
  $("#calendar-today").addEventListener("click", () => {
    selected = new Date();
    month = new Date(selected.getFullYear(), selected.getMonth(), 1);
    refresh();
  });
  window.addEventListener("storage", refresh);
  window.addEventListener("pageshow", refresh);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });
  refresh();
})();
