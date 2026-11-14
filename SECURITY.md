# Security policy

## Reporting a vulnerability

Please report security issues **privately**, not in a public issue or pull
request: on this repository, open the **Security** tab and choose **Report a
vulnerability** (GitHub's private vulnerability reporting). Include what is
affected (package and version, or the site), how to reproduce it, and what an
attacker gains.

This is a project maintained by one person: expect an acknowledgement within a
week, and a fix, an advisory and a release as soon as the issue is confirmed.
You'll be credited in the advisory unless you ask not to be.

## Supported versions

Fixes go into the latest minor release of `grist-widget-sdk` and
`create-grist-widget` (both always carry the same version number). Before
1.0, older minors are not patched: upgrade to get a fix
(<https://gristwidgets.com/docs/cli/upgrading>).

## Scope

- `grist-widget-sdk` and `create-grist-widget` as published on npm.
- The widget template (`templates/grist-widget-template-vite`), whose files
  every scaffolded widget carries, its workflows included.
- The documentation site, <https://gristwidgets.com>.

Out of scope: vulnerabilities in Grist itself (report them to
[Grist Labs](https://github.com/gristlabs/grist-core/security)), and the
development-only dependencies of the documentation site, which are never
published nor shipped to a widget.

## How the project protects its users

- **Releases** are published from GitHub Actions only, with npm Trusted
  Publishing (OIDC, no stored npm token), from the `main` branch through a
  protected `npm` environment. Every version carries an npm provenance
  attestation linking it to the commit and workflow run that built it.
- **Supply chain**: workflows pin every third-party action to a commit SHA,
  run with least-privilege tokens, and install with a frozen lockfile;
  dependency install scripts run only for an explicit allowlist, and pnpm
  refuses dependency versions younger than seven days
  (`minimumReleaseAge`). Scaffolded widgets keep a 24-hour minimum.
- **Grist access tokens**: `useGrist().fetchWithAuth()` only ever sends the
  document's access token to the Grist instance that issued it; an absolute
  URL to another origin throws.
- **The Grist plugin API** (`window.grist`) is loaded, as Grist documents
  it, from `https://docs.getgrist.com/grist-plugin-api.js`. It has no
  subresource-integrity hash on purpose: Grist updates that file in place
  with each release, so a pinned hash would break every widget. A widget
  already runs inside Grist, so this adds no party it doesn't trust.
