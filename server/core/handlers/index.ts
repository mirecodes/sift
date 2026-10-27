import { registerHandlers } from '../api';

let installed = false;

/** Registers every phase's operations (core is built in). Idempotent. */
export function installServerHandlers(): void {
  if (installed) return;
  installed = true;
  registerHandlers({});
}
