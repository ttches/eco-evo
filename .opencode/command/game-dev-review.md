---
description: Review changed code for game-dev code quality and apply the reasonable findings.
agent: build
---

Review the code under discussion and apply the findings you reasonably agree
with.

Target: $ARGUMENTS

Steps:

1. Identify the files under review. Use the arguments above if given;
   otherwise use the files currently under discussion in this conversation,
   and failing that the working-tree changes. If it is still ambiguous, ask
   which files to review.
2. Read the relevant files and briefly state the intent and context of the
   changes. The reviewer needs this context, not just a raw diff.
3. Launch the `game-dev-review` subagent with the Task tool. Pass it the file
   list and the context from step 2. It returns a prioritized findings report
   and does not edit anything.
4. Evaluate the findings. Apply the ones you reasonably agree with, keeping
   edits consistent with the surrounding code. Skip nitpicks, speculative
   suggestions, and anything you judge to be wrong. Do not churn code to
   satisfy a stylistic preference.
5. Verify your changes with `npm run lint` and `npx tsc -b`, and `npm test`
   if logic changed.
6. Report what you applied and what you intentionally skipped, with a one-line
   reason for each skip.
