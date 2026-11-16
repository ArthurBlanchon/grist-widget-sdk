// The CLI's help, printed by `create-grist-widget --help` and shown as the
// docs' CLI reference (apps/www's <CliHelp />): one text, so the two can't
// disagree. The site bundles this file: keep it a plain string, with no
// import, or the docs' build breaks.

export const HELP = `create-grist-widget — scaffold a Grist custom widget, offline

Usage:
  npm create grist-widget <name> [options]       Scaffold into ./<name>
  create-grist-widget create <name> [options]    Same as above, explicit
  create-grist-widget init [options]             Scaffold into the current directory
  create-grist-widget use <example-id>           Replace the current project's widget (src/app/)
  create-grist-widget upgrade [--force]          Bring the template's files up to this CLI's
                                                 (run it on dev, in a widget: pnpm exec create-grist-widget upgrade);
                                                 --force overwrites a src/main.tsx or file of the widget's own
  create-grist-widget demo [--port <n>]          Open the widget in a real Grist on this machine
                                                 (needs Docker; in a widget: pnpm demo)
  create-grist-widget demo --save                Write public/demo/: the widget's demo page and
                                                 document, a real Grist from static files (Docker)
  create-grist-widget release <patch|minor|major>
                                                 On dev: bump the version, write CHANGELOG.md from
                                                 what dev has that main doesn't, and commit
                                                 (in a widget: pnpm release minor)
  create-grist-widget protect [--dry-run]        After the first release: the repository's rulesets
                                                 (main, dev, tags), private vulnerability reporting
                                                 and GitHub Pages, with your gh CLI
  create-grist-widget manifest --base <path> [--dist <dir>] [--owner-repo <owner/repo>]
                                                 Write <dist>/grist-widget.json (default dist/), the
                                                 widget's Grist manifest (run by the deploy workflow
                                                 after vite build; --owner-repo defaults to
                                                 $GITHUB_REPOSITORY)
  create-grist-widget list [--json]              List available starting examples

Options (create / init):
  --example <id>   Start from a named example instead of the blank template
                    (see "list" for ids)
  --yes            Skip interactive prompts, use defaults/flags only
  --no-install     Don't run the package manager install automatically
  --pm <name>      Install with this package manager instead of pnpm (the
                    widget's workflows use pnpm and only read its lockfile)
  --name <name>    (init only) Widget name — default: the current directory's name
  --force          (init only) Overwrite files that already exist and differ
                    from the template

  --help, -h       Show this help
  --version, -v    Show this CLI's version

Note: "create", "init", "use", "upgrade", "demo", "release", "protect", "manifest", and "list" are themselves valid widget names.
A bare "create-grist-widget list" runs the list command, not "scaffold a
widget named list" — use "create-grist-widget create list" for that.`
