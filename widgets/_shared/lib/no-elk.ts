// Stands in for elkjs (EPL-2.0 or GPL-3.0, off the catalog's licence allow
// list) wherever a dependency imports it: see _shared/vite.ts. Mermaid only
// loads it for the ELK layout, which the Mermaid diagram widget locks off.
export default class NoElk {
  constructor() {
    throw new Error("The ELK layout isn't available in this widget: its licence is off the catalog's allow list.")
  }
}
