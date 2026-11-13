import type { GristApiImpl } from "./types"

/** `_grist_api` host implementation. Minimal v1 — extend as needed. */
export function createGristApiImpl(): GristApiImpl {
  return {
    async ping() {
      return "pong"
    },
  }
}
