import reference from "../../../packages/core/api/reference.json";
import { HELP } from "../../../packages/create-grist-widget/src/help.mjs";

// The machine-readable docs (/llms.txt, /llms-full.txt, per-page markdown)
// keep JSX as written, so a generated table would reach agents as a bare
// tag. These expand the components whose content is generated into the
// markdown they render.

type Row = { name: string; kind: string; summary: string; signatures?: string[] };

const cell = (text: string) => text.replace(/\|/g, "\\|").replace(/\n/g, " ");

/** An entry point's reference, as a markdown table. */
export function apiReferenceMarkdown(entry: string): string {
  const rows = (reference as Record<string, Row[]>)[entry];
  if (!rows) throw new Error(`ApiReference: no entry point "${entry}" in packages/core/api/reference.json`);
  const lines = rows.map((row) => {
    const signatures = row.signatures?.map((s) => `<br/>\`${cell(s)}\``).join("") ?? "";
    return `| \`${row.name}\` | ${row.kind} | ${cell(row.summary)}${signatures} |`;
  });
  return ["| Name | Kind | What it is |", "| --- | --- | --- |", ...lines].join("\n");
}

/** `<ApiReference entry="…" />` and `<CliHelp />`, replaced by their content. */
export function expandGeneratedComponents(markdown: string): string {
  return markdown
    .replace(/<ApiReference\s+entry="([^"]+)"\s*\/>/g, (_, entry: string) => apiReferenceMarkdown(entry))
    .replace(/<CliHelp\s*\/>/g, () => "```text\n" + HELP + "\n```");
}
