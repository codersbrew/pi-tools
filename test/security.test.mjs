import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "@mariozechner/jiti";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { default: security, isTempCleanup } = await createJiti(import.meta.url).import(path.join(root, "extensions/security.ts"));

async function check(command, hasUI = true) {
  let listener;
  let confirmations = 0;
  const pi = { on: (_event, callback) => { listener = callback; } };
  security(pi);
  const result = await listener({ toolName: "bash", input: { command } }, {
    hasUI,
    ui: {
      confirm: async () => { confirmations++; return false; },
      notify: () => {},
    },
  });
  return { result, confirmations };
}

test("standalone rm -rf of temporary children skips confirmation even without UI", async () => {
  for (const command of [
    "rm -rf /tmp/build-123",
    "rm -fr ./tmp/build-123 tmp/cache",
    "rm --recursive --force '/var/tmp/run-1'",
    `rm -rf ${os.tmpdir()}/pi-run-1`,
  ]) {
    assert.equal(isTempCleanup(command), true, command);
    assert.deepEqual(await check(command, false), { result: undefined, confirmations: 0 }, command);
  }
});

test("unsafe or ambiguous recursive deletes still require confirmation", async () => {
  for (const command of [
    "rm -rf /tmp", "rm -rf /tmp/", "rm -rf tmp",
    "rm -rf /tmp/run-1 src", "rm -rf /tmp/../home", "rm -rf /tmp/run/./data",
    "rm -rf /tmp/*", "rm -rf /tmp/run; rm -rf src", "rm -rf /tmp/run && echo done",
    "rm -rf /tmp/$NAME", "rm -rf /tmp/run$(echo x)",
    "rm -rf /tmp/run\\ name", "rm -r /tmp/run", "rm -rf /tmp/run > /tmp/log",
    "rm -f -r /etc", "rm --force --recursive /etc",
  ]) {
    assert.equal(isTempCleanup(command), false, command);
    const { result, confirmations } = await check(command);
    assert.equal(confirmations, 1, command);
    assert.equal(result?.block, true, command);
  }
});

test("other dangerous commands stay protected", async () => {
  assert.equal((await check("sudo echo ok")).confirmations, 1);
  assert.equal((await check("rm -rf /tmp/run; sudo echo ok")).confirmations, 1);
});
