---
"grist-widget-sdk": minor
"create-grist-widget": minor
---

A widget's demo data: export `demo` (a `GristWidgetDemo`, from `grist-widget-sdk`) from `src/app/demo.ts`, and `create-grist-widget demo` and `demo --save` open it in place of sample rows: its tables with typed columns (`Ref:<Table>` included), the rows, which column each declared column maps to (several for `allowMultiple`), and the widget's options. Existing widgets can add `src/app/demo.ts`, then run `pnpm demo --save` to regenerate their demo page.
