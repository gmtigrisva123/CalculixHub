# Instructions for Claude

## Weekly Arena routine (standing instruction from the repo owner)

When the scheduled weekly-Arena task runs, finish the job end to end: generate the new arena
(`npx tsx scripts/weekly-arena.ts`, see `docs/admin-arena.md`), commit, push, open a pull request
into `main` using `.github/PULL_REQUEST_TEMPLATE.md`, and **merge it yourself** once CI is green.
The owner does not want to merge these PRs by hand. If CI fails or there is a conflict, make the
smallest fix (never skip tests); only notify the owner if it cannot be resolved or merging is blocked.
