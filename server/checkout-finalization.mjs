import { lstat, rename } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";

const WINDOWS_TRANSIENT = new Set(["EPERM", "EBUSY", "EACCES"]);
const RETRIES = 10;
const DELAY_MS = 150;

// Git or a scanner can briefly retain Windows handles after clone exits.
// Keep promotion atomic: never copy over or remove an existing checkout.
export async function finalizeCheckout(stage, target, {
  platform = process.platform,
  renameDirectory = rename,
  inspectTarget = lstat,
  wait = sleep,
} = {}) {
  async function requireAbsentTarget() {
    try { await inspectTarget(target); }
    catch (error) {
      if (error.code === "ENOENT") return;
      throw error;
    }
    throw Object.assign(new Error("Checkout destination already exists."), { code: "EEXIST", status: 409 });
  }

  for (let attempt = 0; ; attempt++) {
    await requireAbsentTarget();
    try { return await renameDirectory(stage, target); }
    catch (error) {
      if (platform !== "win32" || !WINDOWS_TRANSIENT.has(error.code) || attempt >= RETRIES) throw error;
      await requireAbsentTarget();
      await wait(DELAY_MS);
    }
  }
}
