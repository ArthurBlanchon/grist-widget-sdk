// `grist-widget-deploy check-protection`: run by a widget's deploy workflow
// on each release. The workflow's token can't create rulesets (that takes
// the repository's Administration permission, which GITHUB_TOKEN never
// has), but it can read them: when main, dev or tags has no ruleset, the
// release says so in its summary, and the first release opens one issue
// asking the owner to run `create-grist-widget protect`. It never fails the
// deploy. Node builtins only (global fetch): it runs next to a write token.

export const EXPECTED_RULESETS = ["main", "dev", "tags"]
export const ISSUE_TITLE = "Protect this repository"

/** The issue the first release opens, listing what is missing. */
export function protectionIssueBody(missing) {
  return [
    "This widget's first release is live. Its repository still lacks the rulesets a copy of the template doesn't get" +
      ` (missing: ${missing.map((m) => `\`${m}\``).join(", ")}).`,
    "",
    "Run, with the [GitHub CLI](https://cli.github.com) logged in as an admin of this repository:",
    "",
    "```bash",
    "pnpm exec create-grist-widget protect --dry-run   # what it would change",
    "pnpm exec create-grist-widget protect",
    "```",
    "",
    "It creates the rulesets in `.github/rulesets/` (`main`: a pull request and the `check` status, no force push or deletion;" +
      " `dev`: no force push or deletion; `tags`: no tag moved or deleted), turns private vulnerability reporting on and checks" +
      " GitHub Pages. The workflow can't do it itself: creating rulesets takes an admin token, which a workflow never has.",
    "",
    "Close this issue once it's done: each release checks again and warns in its summary while a ruleset is missing.",
    "See https://gristwidgets.com/docs/cli#the-bundled-deploy-pipeline.",
  ].join("\n")
}

/**
 * `{ missing, issue, note }`: the expected rulesets the repository lacks, the
 * issue opened (its URL) if any, and a note when the check couldn't run.
 */
export async function checkProtection({
  ownerRepo,
  token,
  firstRelease = false,
  apiUrl = "https://api.github.com",
  fetchImpl = globalThis.fetch,
}) {
  const call = async (method, path, body) => {
    const res = await fetchImpl(`${apiUrl}/repos/${ownerRepo}${path}`, {
      method,
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${token}`,
        "x-github-api-version": "2022-11-28",
        ...(body ? { "content-type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    if (!res.ok) throw new Error(`${method} ${path}: HTTP ${res.status}`)
    return res.json()
  }
  try {
    const names = new Set((await call("GET", "/rulesets")).map((r) => r.name))
    const missing = EXPECTED_RULESETS.filter((n) => !names.has(n))
    if (missing.length === 0 || !firstRelease) return { missing, issue: null, note: null }
    const open = await call("GET", "/issues?state=open&per_page=100")
    if (open.some((i) => i.title === ISSUE_TITLE && !i.pull_request)) return { missing, issue: null, note: null }
    const issue = await call("POST", "/issues", { title: ISSUE_TITLE, body: protectionIssueBody(missing) })
    return { missing, issue: issue.html_url, note: null }
  } catch (err) {
    return { missing: null, issue: null, note: `protection check skipped: ${err.message}` }
  }
}
