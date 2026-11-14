# Deploying Dear Sky to Firebase, with CI/CD from GitHub

Researched 2026-11-14. Nothing here was run against the cloud: no deploy, no keys, no GitHub or Cloud settings changed. Every claim has a source in brackets, listed at the end. Things I could not confirm are marked **UNCONFIRMED** and collected in the Gotchas section.

## Summary

- **Deploy everything with the Firebase CLI, not `action-hosting-deploy`.** The action only handles Hosting and requires a service account JSON key as input, so it cannot use keyless auth [S1, S2]. One `firebase deploy --only hosting,functions,firestore` run covers all three targets.
- **Auth with Workload Identity Federation through a service account (no key, no stored secret).** Google's `auth` action calls WIF preferred over key JSON, and the Firebase docs now say `FIREBASE_TOKEN` / `login:ci` is legacy and deprecated in favour of Application Default Credentials [S3, S4]. Result: zero GitHub secrets, which fits the "no secrets in the repo" contest rule.
- **The Firebase web config is public by design, so store it as GitHub repository variables, and write `functions/.env.hybridai-785bb` from those same variables at deploy time.** Secret Manager (`defineSecret`) is not a fit for non-secret values [S5].
- **Do the first deploy by hand as the project Owner.** The CLI has to enable APIs, grant service-agent IAM roles for the Firestore trigger, and set an Artifact Registry cleanup policy once. Without `--force`, a non-interactive deploy fails on that last prompt [S6, S7]. After that, CI runs with a narrower service account.
- **App Check on previews is a trap.** A preview URL such as `hybridai-785bb--pr-1-abc123.web.app` is not a subdomain of `hybridai-785bb.web.app`, so the reCAPTCHA key will not cover it [S8, S9]. Skip PR previews, or build them without the site key (UI and on-device flow only).

## Recommended setup

**Pipeline.** One workflow, triggered on push to `main` (plus a manual `workflow_dispatch`). Steps: checkout, Bun, Node 22, install both lockfiles, `bun run check`, `bun test`, build with `VITE_*` variables, write the functions env file, authenticate with WIF, deploy via `bunx`.

**Why the CLI and not the Hosting action.**
- `FirebaseExtended/action-hosting-deploy` latest release is v0.11.0 (2026-06-25, bumped to Node 24) [S1]. Its `firebaseServiceAccount` input is `required: true` and it is a JSON key [S2]. Open issues ask for WIF support and none is merged (#174, #299, #349, #398, #399) [S10].
- `firebase init hosting:github` creates a service account, uploads its key as a GitHub secret and writes workflow files for PR previews and deploy on merge [S11]. That is the key-based path we want to avoid. Its service account only has Hosting permissions, not Functions or Firestore [S12, S13].
- The action does allow a Bun build: it just runs after your own steps (README: "Add any build steps here") [S2]. So `oven-sh/setup-bun` works with it. We still prefer the CLI for the single-auth-path reason above.

**Why WIF through a service account, not Direct WIF.**
- Both are supported by `google-github-actions/auth@v3`; Direct WIF is labelled "preferred" in its README [S3]. It also warns that not every Google Cloud resource accepts a `principalSet` identity [S3].
- Firebase CLI works with WIF credential files: a reporter used `auth` with a service account and `create_credentials_file: true` and deploys worked on firebase-tools 15.22.1, and a June 2026 break was a Node.js bug, fixed in firebase-tools 15.22.3 [S14, S15]. I found no report of Direct WIF with the CLI, so I recommend impersonation. **UNCONFIRMED** whether Direct WIF would also work.
- The credentials file the action writes points at GitHub's OIDC endpoint (`credential_source.url`), so the CLI can re-request a token during a long deploy rather than reusing one that expires in 5 minutes [S3, S16]. I did not test a deploy longer than 5 minutes.

**Runtime pins.**
- `bunx` runs `firebase-tools` with Node, because Bun honours the `#!/usr/bin/env node` shebang unless you pass `--bun` [S17]. So the runner needs Node. I confirmed locally that both `bunx firebase-tools@15.36.0 --version` and `bunx --package firebase-tools@15.36.0 firebase --version` print 15.36.0.
- Latest firebase-tools is 15.36.0 (2026-11-11), engines `>=20 || >=22 || >=24` [S18].
- Use Node 22.x via `actions/setup-node`. Node 22.23.0 and 24.17.0 had an `http.Agent` regression that made firebase-tools fail with "Failed to authenticate"; fixed in Node 22.23.1 / 24.18.0, and firebase-tools 15.22.3+ also works around it [S15, S19].

**Config.**
- `VITE_FIREBASE_*` and `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY`: GitHub repository **variables**, exposed with `${{ vars.NAME }}` [S20]. These end up in the public JS bundle anyway.
- `functions/.env.hybridai-785bb`: the CLI loads `.env` and `.env.<projectId>` from `functions/` at deploy time and exposes them as `process.env` [S5]. `functions/src/judge.ts` reads `DEAR_SKY_WEB_API_KEY` and `DEAR_SKY_WEB_APP_ID` that way. They are the web app's public key and app id, so reuse the `VITE_FIREBASE_API_KEY` and `VITE_FIREBASE_APP_ID` variables (check they are the same values as in your local file). `.gitignore` already excludes `.env.*`, so the file stays out of git.
- The Firebase docs warn against sensitive data in `.env` files [S5]. These values are not sensitive. Secret Manager gives 6 free active versions and 10,000 free accesses a month, but secret values are unavailable at deploy time and must be bound per function [S5]. That is extra moving parts for no gain.

**Service account roles (starting set, to validate on the first CI run).**
Google documents no single minimal role list for Hosting + 2nd gen Functions + Firestore. What exists:
- Google's own Cloud Build guide grants Cloud Build Service Account, **Firebase Admin** and **API Keys Viewer** for Firebase deploys [S21].
- The Hosting action docs list Firebase Hosting Admin, API Keys Viewer ("required for CLI deploys"), Cloud Run Viewer (for rewrites) and Firebase Auth Admin (only to add preview domains to Auth) [S12].
- IAM docs: `roles/firebase.admin` includes `cloudfunctions.*`, `run.*`, `firebaserules.*` and `firebasehosting.*` [S22]. In the part of the page I read, `datastore.indexes.*` was **not** listed (I read the first 100,000 of 166,000 characters), and the CLI checks `datastore.indexes.*` for Firestore deploys [S23].
- The CLI checks `iam.serviceAccounts.actAs` on `PROJECT_ID@appspot.gserviceaccount.com` and tells you to grant **Service Account User** if missing [S6]. Cloud Run functions docs also say deployers need Service Account User on the runtime and build service accounts [S24].

Proposed set for the CI service account `github-deployer`:

| Role | Why |
|---|---|
| `roles/firebase.admin` | Hosting, Functions, Run, Rules (see S21, S22) |
| `roles/iam.serviceAccountUser` | `actAs` for function runtime and build accounts (S6, S24) |
| `roles/serviceusage.apiKeysViewer` | CLI deploys read API keys (S12, S21) |
| `roles/datastore.indexAdmin` | Firestore indexes, in case Firebase Admin lacks it (S23, UNCONFIRMED) |

It is broad, but the identity is keyless and only your repo can impersonate it. Tighten later by removing roles one at a time while deploying each target [S25 is a community suggestion, not Google guidance].

## One-time steps

Who does what: **User** = in a browser console, **Command** = a terminal command the user runs, **Claude** = something that can be done in the repo once approved. None of these were run.

1. **User, Firebase console.** Authentication, Sign-in method, enable the **Anonymous** provider [S26]. PREP.md notes this still has to be done in the console before deploy. Optional: upgrading to Identity Platform allows auto-cleanup of anonymous accounts older than 30 days [S26].
2. **Command, enable APIs (once, as Owner).** The CLI enables most of these itself during a deploy, but only if the account may enable services, so doing it up front avoids a half-finished first CI run [S7].
   ```bash
   gcloud services enable --project hybridai-785bb \
     cloudfunctions.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com \
     run.googleapis.com eventarc.googleapis.com pubsub.googleapis.com storage.googleapis.com \
     firestore.googleapis.com firebaserules.googleapis.com firebasehosting.googleapis.com \
     identitytoolkit.googleapis.com firebasevertexai.googleapis.com aiplatform.googleapis.com \
     recaptchaenterprise.googleapis.com firebaseappcheck.googleapis.com \
     iam.googleapis.com iamcredentials.googleapis.com sts.googleapis.com \
     cloudresourcemanager.googleapis.com serviceusage.googleapis.com
   ```
   Sources for the list: the CLI's own API list for 2nd gen deploys [S7]; AI Logic needs `aiplatform` and `firebasevertexai` for the Agent Platform provider [S27]; Hosting and Cloud Build APIs [S21]. The WIF APIs (`iam`, `iamcredentials`, `sts`, `cloudresourcemanager`) are my addition from how WIF works; the auth README does not list them in the part I read, so **UNCONFIRMED** (gcloud will prompt to enable anything missing).
3. **User, Google Cloud console.** Create the App Check key: reCAPTCHA Enterprise, key type **Web**, **score-based** (leave "Use checkbox challenge" off), domains `hybridai-785bb.web.app` and `hybridai-785bb.firebaseapp.com` (plus any custom domain). Never add `localhost` to a key used in production [S8]. Listing a parent domain covers its subdomains [S9]. Max 250 domains [S8, S9].
4. **User, Firebase console.** Security, App Check, Apps tab: register the web app with **reCAPTCHA Enterprise** and paste the key. Default token TTL is 1 hour; fine [S8]. Keep the key id for `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY`.
5. **Command, first deploy by hand, as Owner, interactive** (so the CLI can answer its own prompts):
   ```bash
   bun install && (cd functions && bun install)
   bun run build        # with VITE_* set, including the reCAPTCHA site key
   bunx --package firebase-tools@15.36.0 firebase deploy --only hosting,functions,firestore --project hybridai-785bb
   ```
   Why by hand: on the first deploy of a Firestore-triggered function the CLI grants project-level IAM roles to the Pub/Sub and default compute service agents (Token Creator, Run Invoker, Eventarc Event Receiver); a service account without `setIamPolicy` cannot do that [S6]. It also enables the Eventarc and Pub/Sub service identities [S7]. If the build step fails with a permissions error, grant `roles/cloudbuild.builds.builder` to `PROJECT_NUMBER-compute@developer.gserviceaccount.com`; since July 2024 new projects build as the compute account [S28, S29].
6. **Command, set the Artifact Registry cleanup policy now:**
   ```bash
   firebase functions:artifacts:setpolicy --days 1 --project hybridai-785bb
   ```
   (The CLI also offers to do this at the end of the first interactive deploy. `--days` defaults to 1 [S30].) Without a policy, a non-interactive deploy without `--force` finishes deploying the functions and then fails the job with "could not set up cleanup policy" [S31]. See Gotchas.
7. **Command, create the deploy service account and WIF** (adapted from the `auth` README [S3]). Replace `PROJECT_NUMBER`.
   ```bash
   P=hybridai-785bb
   gcloud iam service-accounts create github-deployer --project $P
   for R in roles/firebase.admin roles/iam.serviceAccountUser \
            roles/serviceusage.apiKeysViewer roles/datastore.indexAdmin; do
     gcloud projects add-iam-policy-binding $P \
       --member "serviceAccount:github-deployer@$P.iam.gserviceaccount.com" --role $R
   done
   gcloud iam workload-identity-pools create github --project $P --location global \
     --display-name "GitHub Actions"
   gcloud iam workload-identity-pools providers create-oidc dear-sky --project $P \
     --location global --workload-identity-pool github \
     --attribute-mapping "google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner" \
     --attribute-condition "assertion.repository == 'KrishKoria/dear-sky'" \
     --issuer-uri "https://token.actions.githubusercontent.com"
   gcloud iam service-accounts add-iam-policy-binding \
     github-deployer@$P.iam.gserviceaccount.com --project $P \
     --role roles/iam.workloadIdentityUser \
     --member "principalSet://iam.googleapis.com/projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github/attribute.repository/KrishKoria/dear-sky"
   gcloud iam workload-identity-pools providers describe dear-sky --project $P \
     --location global --workload-identity-pool github --format "value(name)"
   ```
   The README says always add an attribute condition, and that pool and IAM changes can take up to 5 minutes to propagate [S3]. The last command prints the value for `GCP_WIF_PROVIDER`.
8. **User, GitHub.** Repository, Settings, Secrets and variables, Actions, **Variables** tab: add the variables in the table below. No secrets are needed.
9. **Claude (after approval), repo.** Add `.github/workflows/deploy.yml` from the next section; optionally add `gha-creds-*.json` to `.gitignore` (the `auth` action asks for this to avoid committing credentials [S3]). Push to `main`; watch the first run.
10. **User, Firebase console, after the first CI deploy.** Security, App Check: look at the request metrics for **Cloud Firestore** and **Firebase AI Logic**. Once most requests show as verified, click **Enforce** for Firestore (takes up to 15 minutes to apply) [S32]. AI Logic enforcement is already required: the AI Logic docs say App Check enforcement became mandatory from 2026-11-02, with the last possible delay date 2027-01-21 [S33]. So production needs the reCAPTCHA provider from steps 3 and 4 live **before** you rely on the cloud path. Do not enforce Authentication. The one deployed function is a Firestore trigger (no callable or HTTP function), so there is nothing to enforce on Functions; PREP.md D18's "Functions" line has no effect today. The function writes through the Admin SDK; I expect it is unaffected by Firestore enforcement but did not find a page that says so, **UNCONFIRMED**.

## The workflow

`.github/workflows/deploy.yml` (example only, not created in the repo). Action versions are the latest releases I checked on 2026-11-14: checkout v7.0.1, setup-bun v2.2.0, setup-node v7.1.0, auth v3.0.0 [S34]. For stricter pinning use commit SHAs.

```yaml
name: Deploy

on:
  push:
    branches: [main]
  workflow_dispatch: {}

# One deploy at a time; never cancel a deploy halfway.
concurrency:
  group: deploy-production
  cancel-in-progress: false

permissions:
  contents: read

env:
  FIREBASE_PROJECT: hybridai-785bb
  FIREBASE_TOOLS_VERSION: 15.36.0

jobs:
  deploy:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    permissions:
      contents: read
      id-token: write            # lets google-github-actions/auth request a GitHub OIDC token
    env:
      VITE_FIREBASE_API_KEY: ${{ vars.VITE_FIREBASE_API_KEY }}
      VITE_FIREBASE_AUTH_DOMAIN: ${{ vars.VITE_FIREBASE_AUTH_DOMAIN }}
      VITE_FIREBASE_PROJECT_ID: ${{ vars.VITE_FIREBASE_PROJECT_ID }}
      VITE_FIREBASE_STORAGE_BUCKET: ${{ vars.VITE_FIREBASE_STORAGE_BUCKET }}
      VITE_FIREBASE_MESSAGING_SENDER_ID: ${{ vars.VITE_FIREBASE_MESSAGING_SENDER_ID }}
      VITE_FIREBASE_APP_ID: ${{ vars.VITE_FIREBASE_APP_ID }}
      VITE_RECAPTCHA_ENTERPRISE_SITE_KEY: ${{ vars.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY }}
    steps:
      - uses: actions/checkout@v7.0.1          # must come before auth

      - uses: oven-sh/setup-bun@v2.2.0
        with:
          bun-version: 1.4.4                   # match the version used locally

      - uses: actions/setup-node@v7.1.0        # bunx runs firebase-tools with Node
        with:
          node-version: 22                     # avoid 22.23.0 / 24.17.0 (http.Agent bug)

      - name: Install
        run: |
          bun install --frozen-lockfile
          (cd functions && bun install --frozen-lockfile)

      - name: Check and test
        run: |
          bun run check
          bun test

      - name: Require config
        run: |
          for v in VITE_FIREBASE_API_KEY VITE_FIREBASE_AUTH_DOMAIN VITE_FIREBASE_PROJECT_ID \
                   VITE_FIREBASE_STORAGE_BUCKET VITE_FIREBASE_MESSAGING_SENDER_ID \
                   VITE_FIREBASE_APP_ID VITE_RECAPTCHA_ENTERPRISE_SITE_KEY; do
            if [ -z "${!v}" ]; then echo "::error::repository variable $v is empty"; exit 1; fi
          done

      - name: Build web app
        run: bun run build

      - name: Write functions env (public web config, not committed)
        run: |
          printf 'DEAR_SKY_WEB_API_KEY=%s\nDEAR_SKY_WEB_APP_ID=%s\n' \
            "$VITE_FIREBASE_API_KEY" "$VITE_FIREBASE_APP_ID" \
            > "functions/.env.${FIREBASE_PROJECT}"

      - id: auth
        uses: google-github-actions/auth@v3.0.0
        with:
          workload_identity_provider: ${{ vars.GCP_WIF_PROVIDER }}
          service_account: ${{ vars.GCP_DEPLOY_SA }}
          # create_credentials_file and export_environment_variables default to true,
          # which sets GOOGLE_APPLICATION_CREDENTIALS for the Firebase CLI

      - name: Deploy hosting, functions, firestore
        # No --force: the cleanup-policy prompt is handled once by hand (step 6).
        # Add --force only if you accept that it also deletes functions removed from code.
        run: >
          bunx --package firebase-tools@${FIREBASE_TOOLS_VERSION} firebase deploy
          --only hosting,functions,firestore
          --project "$FIREBASE_PROJECT"
          --non-interactive
          -m "${GITHUB_SHA}"
```

The `functions` predeploy in `firebase.json` runs `bun run --cwd "$RESOURCE_DIR" build`, so Bun must be on the PATH when the CLI runs; `setup-bun` provides that. The CLI itself never needs `npm`.

### Optional: PR preview (Hosting only)

Separate file `.github/workflows/preview.yml`. Previews hit the real backend [S35]. Because the reCAPTCHA key will not cover the preview host, this build deliberately has **no** site key, so App Check is not configured and cloud features are refused (see `src/lib/firebase.ts`); you can review UI and the on-device flow only. Use a second service account `github-previewer` with just `roles/firebasehosting.admin`, and add its own `roles/iam.workloadIdentityUser` binding. Do not reuse the deploy account for pull requests. Fork PRs do not receive OIDC tokens or secrets, so the job is limited to same-repo PRs (standard GitHub behaviour, **UNCONFIRMED** in the pages I fetched, though GitHub's secure-use page says to keep PR-triggered workflows least-privilege [S36]).

```yaml
name: Preview

on:
  pull_request:

permissions:
  contents: read

env:
  FIREBASE_PROJECT: hybridai-785bb
  FIREBASE_TOOLS_VERSION: 15.36.0

jobs:
  preview:
    if: github.event.pull_request.head.repo.full_name == github.repository
    runs-on: ubuntu-latest
    timeout-minutes: 15
    permissions:
      contents: read
      id-token: write
    env:
      VITE_FIREBASE_API_KEY: ${{ vars.VITE_FIREBASE_API_KEY }}
      VITE_FIREBASE_AUTH_DOMAIN: ${{ vars.VITE_FIREBASE_AUTH_DOMAIN }}
      VITE_FIREBASE_PROJECT_ID: ${{ vars.VITE_FIREBASE_PROJECT_ID }}
      VITE_FIREBASE_STORAGE_BUCKET: ${{ vars.VITE_FIREBASE_STORAGE_BUCKET }}
      VITE_FIREBASE_MESSAGING_SENDER_ID: ${{ vars.VITE_FIREBASE_MESSAGING_SENDER_ID }}
      VITE_FIREBASE_APP_ID: ${{ vars.VITE_FIREBASE_APP_ID }}
      # VITE_RECAPTCHA_ENTERPRISE_SITE_KEY intentionally unset
    steps:
      - uses: actions/checkout@v7.0.1
      - uses: oven-sh/setup-bun@v2.2.0
        with:
          bun-version: 1.4.4
      - uses: actions/setup-node@v7.1.0
        with:
          node-version: 22
      - run: bun install --frozen-lockfile
      - run: bun run check && bun test
      - run: bun run build
      - uses: google-github-actions/auth@v3.0.0
        with:
          workload_identity_provider: ${{ vars.GCP_WIF_PROVIDER }}
          service_account: ${{ vars.GCP_PREVIEW_SA }}
      - name: Deploy preview channel
        run: >
          bunx --package firebase-tools@${FIREBASE_TOOLS_VERSION} firebase
          hosting:channel:deploy "pr-${{ github.event.number }}"
          --project "$FIREBASE_PROJECT" --expires 7d --no-authorized-domains
```

Notes on that command: `hosting:channel:deploy CHANNEL_ID --expires` is a documented command, previews can live up to 30 days [S37]. `--no-authorized-domains` skips syncing the preview domain into Firebase Auth's authorized domains, which is the only reason the Hosting action asks for Firebase Auth Admin [S12, S38]. Anonymous sign-in should not need an authorized domain (that list is for OAuth redirects), but I did not find a page that says so, **UNCONFIRMED**. If you would rather have the action's PR comment, you must use a key-based service account; not recommended.

## Secrets and variables

All are GitHub **Variables** (Settings, Secrets and variables, Actions, Variables). There are no secrets. Variables are plain configuration values read with `${{ vars.NAME }}` [S20]; GitHub secrets would also work with `${{ secrets.NAME }}` and are masked in logs, if you prefer that for the two WIF values.

| Name | Where the value comes from | Secret or variable |
|---|---|---|
| `VITE_FIREBASE_API_KEY` | `firebase apps:sdkconfig WEB <app-id>`, or your local `.env.local` | Variable (public by design) |
| `VITE_FIREBASE_AUTH_DOMAIN` | same | Variable |
| `VITE_FIREBASE_PROJECT_ID` | same (`hybridai-785bb`) | Variable |
| `VITE_FIREBASE_STORAGE_BUCKET` | same | Variable |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | same | Variable |
| `VITE_FIREBASE_APP_ID` | same; also written to `DEAR_SKY_WEB_APP_ID` in the functions env | Variable |
| `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY` | Step 3, the key id (public; it ships in the JS) | Variable |
| `GCP_WIF_PROVIDER` | Output of the last command in step 7 (`projects/NUMBER/locations/global/workloadIdentityPools/github/providers/dear-sky`) | Variable (an identifier, not a credential) |
| `GCP_DEPLOY_SA` | `github-deployer@hybridai-785bb.iam.gserviceaccount.com` | Variable |
| `GCP_PREVIEW_SA` (only if you add previews) | `github-previewer@hybridai-785bb.iam.gserviceaccount.com` | Variable |

Mapping to functions env: `DEAR_SKY_WEB_API_KEY` is `VITE_FIREBASE_API_KEY` and `DEAR_SKY_WEB_APP_ID` is `VITE_FIREBASE_APP_ID`, assuming your current `functions/.env.hybridai-785bb` holds the same values (PREP.md D33 says it holds the web app's public key and app id).

## Gotchas

**Deploy behaviour and failure**
- `firebase deploy` runs phases for all targets in order: predeploy, prepare, deploy, release [S39]. Targets are listed firestore, functions, hosting in the CLI [S39]. I did not confirm that `--only` keeps that order. It is not transactional across targets: a failed run can leave Firestore rules new and functions old. Here the rules and the `lightLantern` function are coupled (field names), so avoid changing both in a way that breaks the old half; fix by pushing a corrected commit.
- Cleanup policy: with no Artifact Registry cleanup policy and `--non-interactive` but no `--force`, the CLI deploys functions and then throws "could not set up cleanup policy", failing the job [S31]. That throw happens in the functions release step, so Hosting would not be released in that run (inferred from the phase order [S39]). Fix once with step 6.
- `--force` in non-interactive mode also auto-confirms deleting functions that no longer exist in code and other prompts [S31, S40]. Without `--force`, a non-interactive deploy that would delete a function aborts ("Pass the --force option") [S40]. Today there is one function, so this only matters if you remove or rename it.
- First deploy of an event-triggered 2nd gen function can fail on service-agent propagation or Cloud Build permissions; rerun after a minute, and see step 5 for the compute-account build role [S28, S29].
- **Resolved 2026-11-14:** the postinstall is now `node scripts/link-sdk-bin.mjs` (no Bun needed; does nothing outside Windows), and `"gcp-build": ""` stops Cloud Build running `npm run build` (the buildpack's default; it would fail, since `src/` isn't uploaded) [S41]. Original note follows.
- **Bun in Cloud Build (risk).** `functions/package.json` has `postinstall: bun scripts/link-sdk-bin.ts`. Cloud Build installs dependencies remotely. Google's Node buildpack supports Bun when it finds `bun.lock` (and `functions/bun.lock` exists), so postinstall can work; if it falls back to npm, `bun` would be missing and the install step would fail [S41]. I could not confirm which package manager the Firebase 2nd gen build picks for the `nodejs22` runtime. The first manual deploy (step 5) will show it. Cheap fix if it fails: make the postinstall a no-op outside Windows. That edit is outside this research task.
- Node bug: pin Node 22.x or run firebase-tools 15.22.3 or newer; the failure message is the generic "Failed to authenticate, have you run firebase login?" and the real error only shows with `--debug` [S15, S19].
- Add `--debug` to the deploy command temporarily if auth fails; the CLI swallows the underlying error [S15].
- The Firebase API key must not get an HTTP-referrer restriction later: the Function calls AI Logic from a server using the web key (PREP.md D33), and referrer-restricted keys reject server calls. **UNCONFIRMED**, inferred from how referrer restrictions work.

**Costs and speed**
- Public repo: standard GitHub-hosted runners are free and do not use up included minutes [S42]. If the repo goes private, the Free plan includes $12 of compute a month, about 2,000 Linux minutes at $0.006/min [S42].
- Cloud Build: 2,500 free build-minutes per month per billing account on the default machine type, "subject to change" [S43]. One function means one small build per deploy, so a deploy per push stays well inside this. Artifact Registry gives 0.5 GiB free, then about $0.0001370 per GiB-hour (roughly $0.10 per GiB-month) [S44]; the cleanup policy keeps old images from piling up (default delete after 1 day) [S30].
- Deploy time: **not measured**. Estimate only: build and test about 1 to 2 minutes, a functions deploy through Cloud Build a few minutes. Locally, `bunx` downloading firebase-tools took about 36 s of `re2` postinstall on this Windows machine; on a cold runner expect similar. To avoid that, add `firebase-tools` as a pinned devDependency (this changes `package.json`, so it is your call) or cache Bun's install cache.
- Cold starts: 2nd gen functions run on Cloud Run with up to 1000 concurrent requests per instance, which reduces cold starts under load [S45]. `lightLantern` is Firestore-triggered, so a cold start shows up as a slightly later lantern, not a blocked page. `maxInstances: 5` is already set in `functions/src/index.ts`. A min instance would remove cold starts but bills continuously; I would not add one. Event-triggered functions can run up to 9 minutes [S45]; the code sets 60 s.
- Keep the $5 budget alert already in PREP.md. Blaze billing is also what the Agent Platform cloud calls use (D31).

**Rollback**
- Hosting: Firebase console, Hosting, Release history, hover the previous release, **Roll back**; it creates a new release serving the old content [S46]. CLI alternative: `firebase hosting:clone SITE:@VERSION_ID SITE:live` [S46].
- Functions and rules: no one-click rollback in what I read. Use `git revert` and push; CI redeploys. For speed, use `workflow_dispatch` on a chosen ref (the workflow above deploys the ref it is run on; pick the old commit's branch/tag).
- Keep Hosting releases limited per channel in the console release storage settings if you deploy often [S46].

**App Check and auth**
- Never list `localhost` on the production reCAPTCHA key; use the debug token locally, as `src/lib/firebase.ts` already does [S8].
- App Check will not block until enforced, but AI Logic enforcement is already on (see step 10) [S8, S33].
- The `auth` action docs note that fork-triggered runs and `pull_request_target` are risky; the recommended preview job avoids both by running only for same-repo PRs [S36].
- Optional hardening, **UNCONFIRMED here**: create a GitHub Environment `production` limited to `main`, add `environment: production` to the deploy job, and bind the service account to the `sub` claim (`repo:KrishKoria/dear-sky:environment:production`) instead of the whole repository. I did not re-read GitHub's OIDC docs for the exact claim format today.
- The contest rule: nothing sensitive is committed. The workflow holds no keys; `functions/.env.hybridai-785bb` is ignored by `.gitignore` (`.env.*`) and is created only on the runner.

## Sources

- S1 https://github.com/FirebaseExtended/action-hosting-deploy/releases (v0.11.0 published 2026-06-25, "bump action runtime to Node 24"); checked with the GitHub API.
- S2 https://github.com/FirebaseExtended/action-hosting-deploy (README and `action.yml`: `firebaseServiceAccount` required, `firebaseToolsVersion`, `channelId`, `expires`, `force`; "Add any build steps here").
- S3 https://github.com/google-github-actions/auth (README: WIF preferred, Direct vs via service account, attribute condition caution, 5 minute propagation, `create_credentials_file`, `export_environment_variables`, `id-token: write`, token lifetime warnings, Admin SDK WIF warning, `gha-creds-*.json`).
- S4 https://firebase.google.com/docs/cli (CI section: ADC recommended; `FIREBASE_TOKEN` legacy; `login:ci` deprecated in favour of `GOOGLE_APPLICATION_CREDENTIALS`).
- S5 https://firebase.google.com/docs/functions/config-env (`.env` and `.env.<project>` loaded at deploy; `process.env`; Secret Manager cost; secrets unavailable at deploy time; warning about sensitive data in `.env`).
- S6 https://github.com/firebase/firebase-tools/blob/master/src/deploy/functions/checkIam.ts (actAs check; service-agent role bindings for Pub/Sub and default compute account; `setIamPolicy` failure path).
- S7 https://github.com/firebase/firebase-tools/blob/master/src/deploy/functions/prepare.ts (`STANDARD_APIS`, v2 APIs, enable behaviour).
- S8 https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider
- S9 https://docs.cloud.google.com/recaptcha/docs/create-key-website (parent domain covers subdomains; 250 domain limit; disabling domain verification is a security risk).
- S10 https://github.com/FirebaseExtended/action-hosting-deploy/issues (open issues #174, #299, #349, #398, #399 on WIF or keyless auth; found via GitHub search API).
- S11 https://firebase.google.com/docs/hosting/github-integration
- S12 https://github.com/FirebaseExtended/action-hosting-deploy/blob/main/docs/service-account.md (roles: firebaseauth.admin, firebasehosting.admin, run.viewer, serviceusage.apiKeysViewer).
- S13 https://github.com/firebase/firebase-tools/blob/master/src/deploy/index.ts (error text saying the Hosting GitHub action lacks Functions permissions).
- S14 https://github.com/firebase/firebase-tools/issues/10716 (WIF plus impersonation worked on 15.22.1; closed 2026-06-25).
- S15 https://github.com/firebase/firebase-tools/issues/10726 (Node bug and fix in firebase-tools 15.22.3; closed 2026-06-26).
- S16 https://github.com/google-github-actions/auth/blob/main/src/client/workload_identity_federation.ts (credential file uses `credential_source.url`).
- S17 https://bun.sh/docs/pm/bunx (via Context7 `/websites/bun_sh`: bunx respects the node shebang; `--bun` forces Bun).
- S18 https://github.com/firebase/firebase-tools/releases/tag/v15.36.0 and `package.json` (version 15.36.0, engines, bin `firebase`).
- S19 https://github.com/nodejs/node/issues/63989 (`http.Agent` keep-alive regression in 22.23.0 and 24.17.0).
- S20 https://docs.github.com/en/actions/reference/workflows-and-actions/contexts (`vars` context holds configuration variables).
- S21 https://docs.cloud.google.com/build/docs/deploying-builds/deploy-firebase (Cloud Build Service Account, Firebase Admin, API Keys Viewer; Cloud Build, Firebase, Resource Manager, Hosting APIs).
- S22 https://docs.cloud.google.com/iam/docs/roles-permissions/firebase (Firebase Admin includes `cloudfunctions.*`, `run.*`, `firebaserules.*`, `firebasehosting.*`; only 100,000 of 166,000 characters read).
- S23 https://github.com/firebase/firebase-tools/blob/master/src/deploy/index.ts (`TARGET_PERMISSIONS`: firestore needs `datastore.indexes.*`).
- S24 https://docs.cloud.google.com/functions/docs/reference/iam/roles (deployer needs Cloud Functions Admin or Developer and Service Account User on runtime and build accounts).
- S25 https://madgicaltechdom.com/blog/everything-you-need-to-know-how-to-deploy-firebase-functions-using-github-action/ and https://stackoverflow.com/questions/75023232/which-roles-are-needed-in-iam-in-order-to-do-a-firebase-deploy (community role lists; not authoritative).
- S26 https://firebase.google.com/docs/auth/web/anonymous-auth
- S27 https://firebase.google.com/docs/ai-logic/faq-and-troubleshooting (required APIs for the Agent Platform provider: `aiplatform.googleapis.com`, `firebasevertexai.googleapis.com`).
- S28 https://docs.cloud.google.com/functions/docs/building (via search result: July 2024 Cloud Build default-account change; compute default service account builds). Search summary only; page not read directly.
- S29 https://discuss.google.dev/t/cant-get-my-cloud-run-function-w-eventarc-trigger-to-deploy/171023 (community report: grant `roles/cloudbuild.builds.builder` to the compute account).
- S30 https://github.com/firebase/firebase-tools/blob/master/src/commands/functions-artifacts-setpolicy.ts and https://firebase.google.com/docs/functions/manage-functions (`functions:artifacts:setpolicy`, `--days`, `--none`, default 1 day).
- S31 https://github.com/firebase/firebase-tools/blob/master/src/deploy/functions/release/index.ts and `.../prompts.ts` (`setupArtifactCleanupPolicies`; non-interactive without `--force` throws; with `--force` applies default).
- S32 https://firebase.google.com/docs/app-check/enable-enforcement (metrics first; up to 15 minutes; supported products list does not include Cloud Functions).
- S33 https://firebase.google.com/docs/ai-logic/faq-and-troubleshooting (App Check enforcement required from 2026-11-02; delay possible to 2027-01-21).
- S34 GitHub releases API for `actions/checkout` (v7.0.1), `oven-sh/setup-bun` (v2.2.0), `actions/setup-node` (v7.1.0), `google-github-actions/auth` (v3.0.0), `FirebaseExtended/action-hosting-deploy` (v0.11.0); queried 2026-11-14.
- S35 https://firebase.google.com/docs/hosting/test-preview-deploy (preview URL format `PROJECT_ID--CHANNEL_ID-HASH.web.app`; previews use the real backend).
- S36 https://docs.github.com/en/actions/reference/security/secure-use (least privilege; avoid `pull_request_target` with untrusted code).
- S37 https://firebase.google.com/docs/hosting/manage-hosting-resources (`hosting:channel:deploy`, `--expires`, up to 30 days; rollback; `hosting:clone`).
- S38 https://github.com/firebase/firebase-tools/blob/master/src/commands/hosting-channel-deploy.ts (`--no-authorized-domains`: do not sync channel domains with Firebase Auth).
- S39 https://github.com/firebase/firebase-tools/blob/master/src/deploy/index.ts (`VALID_DEPLOY_TARGETS` order; predeploy, prepare, deploy, release chains).
- S40 https://github.com/firebase/firebase-tools/blob/master/src/deploy/functions/prompts.ts (non-interactive deletion and unsafe-update prompts need `--force`).
- S41 https://docs.cloud.google.com/docs/buildpacks/nodejs (Bun detected from `bun.lock`; `GOOGLE_PACKAGE_MANAGER=bun`; says nothing on postinstall).
- S42 https://docs.github.com/en/billing/concepts/product-billing/github-actions (standard runners free in public repos; $12 monthly compute on Free for private).
- S43 https://cloud.google.com/build/pricing (2,500 free build-minutes per month, e2-standard-2, subject to change).
- S44 https://cloud.google.com/artifact-registry/pricing (0.5 GiB free, then $0.000136986 per GiB-hour).
- S45 https://firebase.google.com/docs/functions/version-comparison (2nd gen concurrency up to 1000 per instance; event-triggered timeout up to 9 minutes).
- S46 https://firebase.google.com/docs/hosting/manage-hosting-resources (console rollback creates a new release; release storage limits per channel).

## Not confirmed

- Whether Direct WIF works with firebase-tools (I recommend impersonation instead).
- A deploy longer than 5 minutes with WIF (the credential file design suggests it refreshes; untested).
- The exact minimal IAM role set; `roles/datastore.indexAdmin` need; whether `roles/firebase.admin` covers Firestore indexes (I read only part of the role page).
- Which package manager Firebase's 2nd gen build uses on `nodejs22` (affects the `bun` postinstall in `functions/package.json`).
- Whether `--only hosting,functions,firestore` keeps the firestore, functions, hosting release order.
- Whether Admin SDK writes from the Function are exempt from Firestore App Check enforcement.
- Whether anonymous sign-in works on a preview domain without being in Auth authorized domains.
- Whether Hosting deploys are atomic (Firebase page I read does not say).
- GitHub environment `sub` claim format for the optional hardening; fork PR secret and OIDC behaviour (standard, not re-read today).
- Real deploy duration in CI.
