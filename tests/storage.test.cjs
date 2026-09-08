const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../static/js/storage.js'), 'utf8');

function setup(initial = {}) {
  const values = new Map(Object.entries(initial));
  const localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const context = vm.createContext({ localStorage });
  vm.runInContext(source, context);
  return { store: context.StepLogStore, values, localStorage, context };
}

test('legacy data migrates once without changing its backup', () => {
  const original = JSON.stringify({ focus: '旧目標', focusDone: true, journal: '旧日記', todos: [] });
  const { store, values } = setup({ 'steplog:v1': original });
  assert.equal(store.getDay().journal, '旧日記');
  assert.equal(values.get('steplog:v1'), original);
  store.saveDay(store.dateKey(), { ...store.emptyRecord(), journal: '更新' });
  assert.equal(store.getDay().journal, '更新');
});

test('saving another date preserves prior days and uses local date components', () => {
  const { store, context } = setup();
  assert.equal(vm.runInContext('StepLogStore.dateKey(new Date(2026, 0, 1, 0, 1))', context), '2026-01-01');
  store.saveDay('2025-12-31', { journal: '前日', todos: [{ id: '1', text: '読書', done: true }] });
  store.saveDay('2026-01-01', { focus: '新年', focusDone: false });
  assert.equal(store.getDay('2025-12-31').journal, '前日');
  assert.equal(store.getDay('2025-12-31').todos[0].done, true);
  assert.equal(store.getDay('2026-01-01').focus, '新年');
  assert.equal(store.getDay('2026-01-02').todos.length, 0);
});

test('malformed storage stays intact and is reported', () => {
  for (const key of ['steplog:v1', 'steplog:v2']) {
    const { store, values } = setup({ [key]: '{invalid' });
    assert.throws(() => store.getDays());
    assert.throws(() => store.saveDay('2026-01-01', {}));
    assert.equal(values.get(key), '{invalid');
  }
});

test('storage failure is not reported as a successful save', () => {
  const { store, localStorage } = setup();
  localStorage.setItem = () => { throw new Error('quota exceeded'); };
  assert.throws(() => store.saveDay('2026-01-01', { journal: '保存できない' }));
});

test('daily rollover saves the outgoing journal and resets the dashboard', () => {
  const { store, context } = setup();
  const elements = new Map();
  const element = () => ({ value: '', textContent: '', hidden: false, classList: { toggle() {} }, addEventListener() {}, setAttribute() {}, replaceChildren() {}, append() {}, focus() {} });
  context.document = { querySelector: key => { if (!elements.has(key)) elements.set(key, element()); return elements.get(key); }, createElement: element, addEventListener() {} };
  context.window = context;
  context.addEventListener = () => {};
  context.setInterval = () => 0;
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../static/js/app.js'), 'utf8'), context);
  const originalKey = context.StepLogApp.getActiveDateKey();
  elements.get('#journal-input').value = '日付をまたいだ下書き';
  vm.runInContext("todayKey = () => '2099-01-01'; StepLogApp.checkDateRollover()", context);
  assert.equal(context.StepLogApp.getActiveDateKey(), '2099-01-01');
  assert.equal(store.getDay(originalKey).journal, '日付をまたいだ下書き');
  assert.equal(elements.get('#journal-input').value, '');
});
