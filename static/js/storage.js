(function attachStepLogStore(global) {
  "use strict";

  const STORAGE_KEY = "steplog:v2";
  const LEGACY_STORAGE_KEY = "steplog:v1";
  const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

  function createError(message, cause) {
    const error = new Error(message);
    error.name = "StepLogStorageError";
    if (cause) error.cause = cause;
    return error;
  }

  function emptyRecord() {
    return {
      focus: "",
      focusDone: false,
      todos: [],
      journal: "",
    };
  }

  function dateKey(date = new Date()) {
    const value = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(value.getTime())) {
      throw new TypeError("dateKey requires a valid date");
    }

    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function isPlainObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function normalizeRecord(value) {
    const source = isPlainObject(value) ? value : {};
    const todos = [];
    const usedIds = new Set();

    if (Array.isArray(source.todos)) {
      source.todos.forEach((todo, index) => {
        if (!isPlainObject(todo)) return;

        let id = typeof todo.id === "string" && todo.id ? todo.id : `todo-${index + 1}`;
        while (usedIds.has(id)) id = `${id}-${index + 1}`;
        usedIds.add(id);
        todos.push({
          id,
          text: typeof todo.text === "string" ? todo.text : "",
          done: todo.done === true,
        });
      });
    }

    return {
      focus: typeof source.focus === "string" ? source.focus : "",
      focusDone: source.focusDone === true,
      todos,
      journal: typeof source.journal === "string" ? source.journal : "",
    };
  }

  function cloneRecord(record) {
    return normalizeRecord(record);
  }

  function readItem(storage, key) {
    let raw;
    try {
      raw = storage.getItem(key);
    } catch (error) {
      throw createError("Unable to read StepLog data", error);
    }
    if (raw === null) return { exists: false, valid: true, value: null };

    try {
      return { exists: true, valid: true, value: JSON.parse(raw) };
    } catch (error) {
      return { exists: true, valid: false, value: null, error };
    }
  }

  function readV2(storage) {
    const item = readItem(storage, STORAGE_KEY);
    if (!item.exists) return item;
    if (!item.valid || !isPlainObject(item.value) || !isPlainObject(item.value.days)) {
      return { exists: true, valid: false, value: null };
    }
    return item;
  }

  function normalizeDays(days) {
    const result = {};
    Object.keys(days).forEach((key) => {
      if (DATE_KEY_PATTERN.test(key)) result[key] = normalizeRecord(days[key]);
    });
    return result;
  }

  function migrateLegacy(storage, v2) {
    if (v2.exists) return v2.valid ? { days: normalizeDays(v2.value.days) } : null;

    const legacy = readItem(storage, LEGACY_STORAGE_KEY);
    if (!legacy.exists) return { days: {} };
    if (!legacy.valid || !isPlainObject(legacy.value)) {
      throw createError("Legacy StepLog data is malformed; it was left unchanged");
    }

    const migrated = { days: { [dateKey()]: normalizeRecord(legacy.value) } };
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(migrated));
    } catch (error) {
      throw createError("Unable to migrate StepLog data", error);
    }
    return migrated;
  }

  function loadData(storage) {
    const v2 = readV2(storage);
    if (v2.exists && !v2.valid) return { invalid: true, data: null };
    return { invalid: false, data: migrateLegacy(storage, v2) };
  }

  function getStorage() {
    if (!global.localStorage) throw createError("StepLog local storage is unavailable");
    return global.localStorage;
  }

  function getDays() {
    const loaded = loadData(getStorage());
    if (loaded.invalid || !loaded.data) {
      throw createError("Stored StepLog data is malformed; it was left unchanged");
    }
    return normalizeDays(loaded.data.days);
  }

  function getDay(key = dateKey()) {
    if (typeof key !== "string" || !DATE_KEY_PATTERN.test(key)) {
      throw new TypeError("getDay requires a YYYY-MM-DD date key");
    }
    const days = getDays();
    return cloneRecord(days[key] || emptyRecord());
  }

  function saveDay(key, record) {
    if (typeof key !== "string" || !DATE_KEY_PATTERN.test(key)) {
      throw new TypeError("saveDay requires a YYYY-MM-DD date key");
    }

    const storage = getStorage();
    const loaded = loadData(storage);
    if (loaded.invalid || !loaded.data) {
      throw createError("Stored StepLog data is malformed; it was left unchanged");
    }

    const days = normalizeDays(loaded.data.days);
    days[key] = normalizeRecord(record);
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify({ days }));
    } catch (error) {
      throw createError("Unable to save StepLog data", error);
    }
    return cloneRecord(days[key]);
  }

  global.StepLogStore = Object.freeze({
    STORAGE_KEY,
    LEGACY_STORAGE_KEY,
    dateKey,
    emptyRecord,
    getDay,
    getDays,
    saveDay,
  });
})(typeof window === "undefined" ? globalThis : window);
