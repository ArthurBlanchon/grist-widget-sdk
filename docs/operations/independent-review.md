# Independent review

> Read this before merging a pull request that `AGENTS.md`'s "Who merges
> what" gives to the maintainer's go
> ([ADR 0012](../decisions/0012-merge-authority.md)).

The agent that wrote a change is badly placed to judge it, because it shares
its own assumptions. Before such a pull request merges, a session that did
not write it reviews it. The maintainer reads that review before giving the
go.

1. **Start a fresh session** with no context but the pull request: a new
   agent session, or a subagent. Its prompt is the one below, word for word,
   with only the number filled in. The author doesn't write it, so the author
   can't steer it.
2. **It reviews:**
   - `code-review` for every such pull request;
   - `security-review` as well for anything in these places:
     - `.github/`;
     - the release (`scripts/release/`, `.changeset/config.json`);
     - what CI, `gate` or a deploy runs;
     - the SDK's runtime;
     - code that handles data from a Grist document.
3. **Its verdict goes on the pull request** as one comment: what it checked,
   each finding with its severity, or "no finding". The author posts it as
   returned.
4. **Every finding gets an answer before the merge:** a fix pushed, or one
   line on why it doesn't apply. A blocking finding is fixed. A security
   finding stays open until the maintainer decides.
5. **The comment is linked** in the pull request's "Independent review"
   line.

## The reviewer's prompt

```text
You are an independent reviewer. Review pull request #<number> of
ArthurBlanchon/grist-widget-sdk: fetch its branch and diff it against its
base. Read only: modify, commit, push or comment nowhere. Read AGENTS.md and
docs/decisions/ first: the change must hold to them.

Check correctness and security in depth: what can break, for whom, and how
an attacker or a confused agent could misuse it. Return a concise verdict:
each finding with its severity (blocking / should fix / nit), file and
line, the concrete failure, and a suggested fix; or "no finding" with what
you checked.
```
