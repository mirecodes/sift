import { registerHandlers } from '../api';
import { socialHandlers } from './social';

let installed = false;

/** Registers every phase's operations (core is built in). Idempotent. */
export function installServerHandlers(): void {
  if (installed) return;
  installed = true;
  registerHandlers({ ...socialHandlers });
}
