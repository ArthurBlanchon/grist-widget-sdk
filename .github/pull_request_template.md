## Summary

<!-- What changed and why. Link the TODO.md item or the issue it closes. -->

## Merge authority

<!-- The row of AGENTS.md's "Who merges what" this pull request falls under
     (the stricter one if it touches two), and, when that row asks for it,
     the maintainer's go (quote it). -->

- Row:
- Maintainer's go: <!-- not needed / quote -->
- Independent review: <!-- not needed / the second session's verdict, linked -->

## Checks

<!-- Tick what applies; say why for anything left out. -->

- [ ] `pnpm test` (SDK, examples' typecheck, site), or the parts this touches
- [ ] A changeset, if a published package or the template changes for its users
- [ ] Docs updated with the behaviour (`apps/www/content/docs/`)
- [ ] `TODO.md`: the item done removed, any new one added

### For a catalog widget (`widgets/<slug>/`)

- [ ] `SPEC.md` up to date, each acceptance criterion with its test (`it("AC-n …")`)
- [ ] `node scripts/widgets/check-widgets.mjs`, then typecheck, lint, test and build for the widget
- [ ] Its `version` raised in `package.json` (patch, minor, or a major with the maintainer's go)
- [ ] The real-Grist check (CI's `widgets` job, or `pnpm e2e:grist widgets/<slug> --build --axe --themes`), light and dark screenshots looked at
- [ ] English and French text, no hard-coded colour or pixel size, links from data http(s) only
