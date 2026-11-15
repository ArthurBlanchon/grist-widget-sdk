# Independent review

> Read this before merging a pull request that `AGENTS.md`'s "Who merges
> what" gives to the maintainer's go
> ([ADR 0012](../decisions/0012-merge-authority.md)).

The agent that wrote a change is the worst-placed to judge it: it shares
its own assumptions. Before such a pull request merges, a second session,
one that did not write it, reviews it.

1. **Start a fresh session** on the pull request's branch: a new agent
   session, or a subagent given no context but the pull request's number.
2. **Run the review:**
   - `/code-review <pull request>` for code, docs and the template;
   - `/security-review` as well for `.github/`, the release, the SDK's
     runtime, and anything that handles data from a Grist document.
3. **Post its verdict on the pull request,** as one comment: what it
   checked, each finding, and "no finding" when there is none.
4. **Answer every finding** before the merge: a fix pushed, or one line on
   why it doesn't apply. A security finding stays open until the maintainer
   decides.
5. **Link the comment** in the pull request's "Independent review" line.

The review doesn't replace the maintainer's go; it is what the maintainer
reads before giving it.
