import { HELP } from "../../../packages/create-grist-widget/src/help.mjs";

// The CLI's reference: the very text `create-grist-widget --help` prints, read
// from the CLI's source, so the page lists every command and option the CLI
// has, and nothing it doesn't.
export function CliHelp() {
  return (
    <pre>
      <code>{HELP}</code>
    </pre>
  );
}
