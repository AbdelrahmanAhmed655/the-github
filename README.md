# GitHub Actions: Jobs, Runners, and Steps

GitHub Actions is GitHub's built-in CI/CD system. You describe automation in a YAML
file under `.github/workflows/`, and GitHub runs it for you when something happens in
your repository — a push, a pull request, a schedule, or a manual click.

Three pieces do most of the work: **jobs**, **runners**, and **steps**.

## The mental model

```
Workflow            (one .yml file — "what triggers this and what should happen")
└── Job             (a unit of work that gets its own fresh machine)
    ├── Runner      (the machine the job runs on)
    └── Steps       (the ordered commands/actions executed on that machine)
```

Read it as a sentence: *a workflow contains jobs; each job is assigned a runner; the
runner executes the job's steps in order.*

## Workflow

The container for everything else. It lives in `.github/workflows/ci.yml` (any
filename, as long as it's in that folder) and defines **when** to run and **what** to run.

```yaml
name: CI                  # shown in the Actions tab

on:                       # the triggers
  push:
    branches: [main]
  pull_request:
  workflow_dispatch:      # adds a "Run workflow" button

jobs:
  # jobs go here
```

## Job

A **job** is a named group of steps that runs on one machine. Key properties:

- **Each job gets a clean, isolated machine.** Nothing on disk carries over from one
  job to another — no checked-out code, no installed packages, no build output.
- **Jobs run in parallel by default.** Add `needs:` to force an order.
- A job succeeds only if all of its steps succeed. One failing step fails the job
  (unless you set `continue-on-error`).

```yaml
jobs:
  test:                        # "test" is the job ID
    name: Run unit tests       # optional friendly label
    runs-on: ubuntu-latest
    steps:
      - run: echo "testing"

  deploy:
    runs-on: ubuntu-latest
    needs: test                # waits for `test` to pass first
    if: github.ref == 'refs/heads/main'
    steps:
      - run: echo "deploying"
```

To share data between jobs, you have to be explicit:

- **files** → upload/download artifacts (`actions/upload-artifact`, `actions/download-artifact`)
- **values** → job `outputs`
- **dependencies** → re-install them, or restore from `actions/cache`

### Matrix jobs

One job definition can fan out into several parallel runs:

```yaml
jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
        node: [20, 22]
    steps:
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node }}
```

That's 3 × 2 = 6 independent jobs, each with its own runner.

## Runner

A **runner** is the machine (a VM or container) that executes a job. You pick one with
`runs-on`.

### GitHub-hosted runners

GitHub provisions a fresh VM, runs your job, then destroys it. Common labels:

| Label | Machine |
|---|---|
| `ubuntu-latest` | Latest Ubuntu LTS — the default choice, cheapest and fastest |
| `ubuntu-24.04` / `ubuntu-22.04` | Pinned Ubuntu version |
| `windows-latest` | Windows Server |
| `macos-latest` | macOS (needed for iOS/macOS builds; costs the most minutes) |

These images come preloaded with common tooling — git, Docker, Node, Python, Go, build
toolchains — so you often don't need to install much. Public repos get free minutes;
private repos draw from your plan's quota, and Windows/macOS minutes are billed at a
multiplier.

### Self-hosted runners

You install the runner agent on your own hardware and target it by label:

```yaml
runs-on: [self-hosted, linux, gpu]
```

Use these when you need special hardware, a private network, or want to avoid hosted
minute costs. Trade-off: **you** maintain the machine, and because the filesystem
persists between jobs it isn't clean by default. Never attach a self-hosted runner to a
public repo — forked pull requests could run untrusted code on your machine.

### Containers and services

A job can run its steps inside a container, and start side-car services:

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    container: node:22          # steps execute inside this image
    services:
      postgres:                 # a database reachable at localhost:5432
        image: postgres:16
        env:
          POSTGRES_PASSWORD: postgres
```

## Steps

**Steps** are the ordered list of things a job actually does. They run sequentially on
the same runner, and they share the filesystem and the working directory — which is why
`actions/checkout` is almost always step one.

There are exactly two kinds of step.

### 1. `run` — execute shell commands

```yaml
- name: Install dependencies
  run: npm ci

- name: Multi-line script
  run: |
    npm run lint
    npm test -- --coverage
  working-directory: ./app
  env:
    NODE_ENV: test
  shell: bash          # defaults: bash on Linux/macOS, pwsh on Windows
```

### 2. `uses` — run a reusable action

An action is packaged, versioned automation from the Marketplace, another repo, or your
own `.github/actions/` folder. Inputs go under `with:`.

```yaml
- uses: actions/checkout@v4          # clone the repo onto the runner

- uses: actions/setup-node@v4
  with:
    node-version: 22
    cache: npm
```

Always pin a version (`@v4`, or a full commit SHA for third-party actions you don't
control). `@main` means your builds can change without you touching anything.

### Useful step options

| Option | What it does |
|---|---|
| `name` | Label shown in the logs |
| `id` | Lets later steps read this step's outputs: `${{ steps.<id>.outputs.foo }}` |
| `if` | Run conditionally — e.g. `if: failure()`, `if: github.event_name == 'push'` |
| `env` | Environment variables for that step only |
| `continue-on-error` | A failure here doesn't fail the job |
| `timeout-minutes` | Kill the step if it runs too long |

Passing a value from one step to the next:

```yaml
- id: version
  run: echo "tag=v1.2.3" >> "$GITHUB_OUTPUT"

- run: echo "Releasing ${{ steps.version.outputs.tag }}"
```

## Putting it together

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  # ── JOB 1 ───────────────────────────────────────────────
  test:
    name: Test
    runs-on: ubuntu-latest        # ← the RUNNER
    steps:                        # ← the STEPS
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - name: Install
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Test
        run: npm test

      - name: Build
        run: npm run build

      - name: Save build output
        uses: actions/upload-artifact@v4
        with:
          name: dist
          path: dist/

  # ── JOB 2 ── fresh machine, so it re-downloads the build ─
  deploy:
    name: Deploy
    runs-on: ubuntu-latest
    needs: test                              # only if `test` passed
    if: github.ref == 'refs/heads/main'      # only on main
    steps:
      - uses: actions/download-artifact@v4
        with:
          name: dist
          path: dist/

      - name: Deploy
        run: ./scripts/deploy.sh
        env:
          API_TOKEN: ${{ secrets.API_TOKEN }}
```

## Quick reference

| Term | One-line definition | YAML key |
|---|---|---|
| Workflow | An automated process triggered by repo events | the file in `.github/workflows/` |
| Job | A set of steps sharing one machine; parallel by default | `jobs.<id>` |
| Runner | The machine executing a job | `runs-on` |
| Step | A single command or action, run in order | `steps[]` |
| Action | Reusable, versioned automation called by a step | `uses` |

## Common gotchas

- **Forgetting `actions/checkout`.** The runner starts empty — your code isn't there
  until you check it out.
- **Expecting state to survive between jobs.** It doesn't. Use artifacts, outputs, or cache.
- **Using `needs` when you meant steps.** If two things must share a filesystem, they
  belong in the same job as sequential steps, not separate jobs.
- **Hardcoding secrets.** Use `${{ secrets.NAME }}`; never commit tokens to the YAML.
- **Floating action versions.** Pin them so a dependency update can't break your pipeline.
