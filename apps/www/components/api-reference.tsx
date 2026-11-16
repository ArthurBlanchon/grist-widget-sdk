import reference from "../../../packages/core/api/reference.json";

// Every public name of one entry point, generated: packages/core's
// `api:report` writes reference.json from the SDK's TSDoc (and CI fails when
// it is stale), so this table is never written by hand. A committed file, not
// the SDK's build: the site still builds whatever the SDK's state.

type Row = { name: string; kind: string; summary: string; signatures?: string[] };
type Entry = keyof typeof reference;

/** `code` spans in a summary, rendered as code. */
function Summary({ text }: { text: string }) {
  return (
    <>
      {text.split(/(`[^`]+`)/).map((part, i) =>
        part.startsWith("`") && part.endsWith("`") && part.length > 1 ? <code key={i}>{part.slice(1, -1)}</code> : part
      )}
    </>
  );
}

export function ApiReference({ entry }: { entry: Entry }) {
  // MDX isn't type-checked: an unknown entry fails the build by name.
  const rows = (reference as Record<string, Row[] | undefined>)[entry];
  if (!rows) throw new Error(`ApiReference: no entry point "${entry}" in packages/core/api/reference.json`);
  return (
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Kind</th>
          <th>What it is</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.name}>
            <td>
              <code>{row.name}</code>
            </td>
            <td>{row.kind}</td>
            <td>
              <Summary text={row.summary} />
              {row.signatures?.map((signature) => (
                <pre key={signature}>
                  <code>{signature}</code>
                </pre>
              ))}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
