import Link from "next/link";

import widgets from "../../../widgets.json";

// The catalog `npx grist-widget list` prints, made browsable. Same data --
// packages/create-grist-widget embeds this exact file verbatim as its own
// manifest.json at pack time (scripts/build-widgets-manifest.mjs), so this
// table can never list an id the CLI doesn't actually offer.
//
// Not the landing-page example switcher (that's Batch N) -- just answers
// "which id do I pass to `use`/`create --example`", right where `list`/
// `use` are already documented.
export function ExamplesCatalog() {
  return (
    <table>
      <thead>
        <tr>
          <th>Example</th>
          <th>Description</th>
          <th>Use</th>
        </tr>
      </thead>
      <tbody>
        {widgets.map((widget) => (
          <tr key={widget.id}>
            <td>
              {/* The example in a real Grist (grist-static), served by this site. */}
              <Link href={`/examples/${widget.id}/demo/`}>{widget.title}</Link>
            </td>
            <td>{widget.description}</td>
            <td>
              <code>{widget.id}</code>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
