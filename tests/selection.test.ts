import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { readSelection } from "../src/selection";
import { state } from "./raycast-mock.cjs";

test("waits for a delayed selection instead of returning the previous clipboard entry", async (t) => {
  const clipboard = mock.method(
    state,
    "clipboardText",
    async () => "Old clipboard",
  );
  const selected = mock.method(state, "selectedText", async () =>
    selected.mock.callCount() < 2 ? "Old clipboard" : "  Current selection\n",
  );
  t.after(() => mock.restoreAll());
  assert.equal(await readSelection(), "  Current selection\n");
  assert.equal(clipboard.mock.callCount(), 1);
  assert.equal(selected.mock.callCount(), 3);
});

test("reads an unambiguous selection once", async (t) => {
  const selected = mock.method(
    state,
    "selectedText",
    async () => "Current selection",
  );
  t.after(() => mock.restoreAll());
  assert.equal(await readSelection(), "Current selection");
  assert.equal(selected.mock.callCount(), 1);
});

test("bounds retries when the selected text legitimately equals the clipboard", async (t) => {
  mock.method(state, "clipboardText", async () => "Same text");
  const selected = mock.method(state, "selectedText", async () => "Same text");
  t.after(() => mock.restoreAll());
  assert.equal(await readSelection(), "Same text");
  assert.equal(selected.mock.callCount(), 5);
});

test("does not return old clipboard text when selection fails during verification", async (t) => {
  mock.method(state, "clipboardText", async () => "Old clipboard");
  const selected = mock.method(state, "selectedText", async () => {
    if (selected.mock.callCount() === 0) return "Old clipboard";
    throw new Error("No selection");
  });
  t.after(() => mock.restoreAll());
  await assert.rejects(readSelection(), /No selection/);
  assert.equal(selected.mock.callCount(), 2);
});

test("clipboard lookup failure does not prevent reading the selection", async (t) => {
  mock.method(state, "clipboardText", async () => {
    throw new Error("Unavailable");
  });
  mock.method(state, "selectedText", async () => "Current selection");
  t.after(() => mock.restoreAll());
  assert.equal(await readSelection(), "Current selection");
});
