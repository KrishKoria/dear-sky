# Deploying Dear Sky

Live at `https://hybridai-785bb.web.app` once step 5 is done. After setup, every push to `main` deploys itself through `.github/workflows/deploy.yml`. The reasons and sources behind each step are in `research/deploy-cicd.md`.

**You** = you, in Chrome (Browser 1), signed in to the Google account that owns `hybridai-785bb`. **Claude** = Claude does it from this repo, after your OK.

Nothing here costs money beyond the Blaze plan you already have. GitHub Actions is free for this public repo, and the deploys fit inside Cloud Build's free monthly minutes.

## Setup (once)

### 1. You: turn on anonymous sign-in

[Firebase console → Authentication → Sign-in method](https://console.firebase.google.com/project/hybridai-785bb/authentication/providers) → **Anonymous** → Enable → Save.

### 2. You: turn on the Google APIs (Cloud Shell)

Open [Cloud Shell](https://console.cloud.google.com/?project=hybridai-785bb&cloudshell=true) (the terminal icon, top right of the Cloud console). It runs as the account you're signed in with, so check it's the project owner. Paste:

```bash
gcloud config set project hybridai-785bb
gcloud services enable \
  cloudfunctions.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com \
  run.googleapis.com eventarc.googleapis.com pubsub.googleapis.com storage.googleapis.com \
  firestore.googleapis.com firebaserules.googleapis.com firebasehosting.googleapis.com \
  identitytoolkit.googleapis.com firebasevertexai.googleapis.com aiplatform.googleapis.com \
  recaptchaenterprise.googleapis.com firebaseappcheck.googleapis.com \
  iam.googleapis.com iamcredentials.googleapis.com sts.googleapis.com \
  cloudresourcemanager.googleapis.com serviceusage.googleapis.com
```

This takes a minute or two. Already-enabled APIs are fine.

### 3. You: make the reCAPTCHA key (same Cloud Shell)

This is the key App Check uses to tell the real app apart from scripts. It only works on the two live domains, never on `localhost` (local development keeps using the debug token).

```bash
gcloud recaptcha keys create --display-name="Dear Sky web" \
  --web --domains=hybridai-785bb.web.app,hybridai-785bb.firebaseapp.com \
  --integration-type=score
```

Created [6LflOCAuAAAAAJzl9A1rr_Eozt8Cw4CYtp54V-Tj].
It prints a name ending in `/keys/SOMETHING`. The `SOMETHING` part is the **site key**. Copy it; it isn't secret (it ships inside the page).

### 4. You: register the key with App Check

[Firebase console → App Check → Apps](https://console.firebase.google.com/project/hybridai-785bb/appcheck/apps) → the web app → **reCAPTCHA Enterprise** → paste the site key → Save. Leave the token time at its default (1 hour). **Don't press Enforce yet** (step 10).

Then send Claude the site key. Claude adds it to `.env.local` as `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY`.

### 5. Claude: the first deploy, from this computer

Done once by hand, as the project owner, because the very first deploy also wires up permissions for the Firestore trigger that the CI account won't be allowed to grant. Before it runs, Claude checks that the Firebase CLI here is signed in to the owner account.

These run in the local terminal (PowerShell), so each command stays on one line:

```powershell
bun run build
cd functions && bun install && cd ..
bunx --package firebase-tools@15.36.0 firebase deploy --only hosting,functions,firestore --project hybridai-785bb --non-interactive --force
```

**Expected on the very first try:** it can fail with "Permission denied while using the Eventarc Service Agent … retry the deployment in a few minutes". Google is still setting up the trigger's permissions. Wait 5 minutes and run the same deploy command again. Nothing needs undoing.

`--force` is safe on this first deploy only: there are no old functions yet for it to delete, and it also turns on the 1-day cleanup of old function images (otherwise every deploy leaves a copy behind). If the build step fails with a permissions error, run this in Cloud Shell and deploy again:

```bash
N=$(gcloud projects describe hybridai-785bb --format='value(projectNumber)')
gcloud projects add-iam-policy-binding hybridai-785bb \
  --member "serviceAccount:$N-compute@developer.gserviceaccount.com" \
  --role roles/cloudbuild.builds.builder
```

**Then, once, in Cloud Shell:** let the function sign its own App Check token. Without this, moderation fails with `iam.serviceAccounts.signBlob denied` and lanterns stay at "waiting for the wind". 2nd-gen functions run as the default compute account:

```bash
N=$(gcloud projects describe hybridai-785bb --format='value(projectNumber)')
gcloud iam service-accounts add-iam-policy-binding "$N-compute@developer.gserviceaccount.com" \
  --member "serviceAccount:$N-compute@developer.gserviceaccount.com" \
  --role roles/iam.serviceAccountTokenCreator --project hybridai-785bb
```

Then open `https://hybridai-785bb.web.app` in Chrome and release one lantern end to end.

### 6. Nothing to do

The cleanup policy was set by `--force` in step 5. (If it wasn't: `bunx --package firebase-tools@15.36.0 firebase functions:artifacts:setpolicy --days 1 --project hybridai-785bb`.)

### 7. You: create the GitHub deploy identity (Cloud Shell)

This makes a service account called `github-deployer` and lets **only** the `KrishKoria/dear-sky` repo's workflows act as it. There's no key file anywhere.

```bash
P=hybridai-785bb
N=$(gcloud projects describe $P --format='value(projectNumber)')
SA=github-deployer@$P.iam.gserviceaccount.com

gcloud iam service-accounts create github-deployer --project $P --display-name "GitHub deploys"
for R in roles/firebase.admin roles/iam.serviceAccountUser \
         roles/serviceusage.apiKeysViewer roles/datastore.indexAdmin; do
  gcloud projects add-iam-policy-binding $P --member "serviceAccount:$SA" --role $R --condition None
done

gcloud iam workload-identity-pools create github --project $P --location global \
  --display-name "GitHub Actions"
gcloud iam workload-identity-pools providers create-oidc dear-sky --project $P \
  --location global --workload-identity-pool github \
  --attribute-mapping "google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner" \
  --attribute-condition "assertion.repository == 'KrishKoria/dear-sky'" \
  --issuer-uri "https://token.actions.githubusercontent.com"
gcloud iam service-accounts add-iam-policy-binding $SA --project $P \
  --role roles/iam.workloadIdentityUser \
  --member "principalSet://iam.googleapis.com/projects/$N/locations/global/workloadIdentityPools/github/attribute.repository/KrishKoria/dear-sky"

echo
echo "GCP_WIF_PROVIDER = $(gcloud iam workload-identity-pools providers describe dear-sky --project $P --location global --workload-identity-pool github --format='value(name)')"
echo "GCP_DEPLOY_SA    = $SA"
```

Copy the two lines it prints at the end and send them to Claude. They're identifiers, not passwords. Google says these permissions can take up to 5 minutes to settle.

### 8. Claude: set the GitHub variables

From `.env.local` (the 7 `VITE_*` values, all public) plus the two lines from step 7:

```bash
gh variable set -R KrishKoria/dear-sky -f .env.local
gh variable set -R KrishKoria/dear-sky GCP_WIF_PROVIDER --body "<from step 7>"
gh variable set -R KrishKoria/dear-sky GCP_DEPLOY_SA --body "github-deployer@hybridai-785bb.iam.gserviceaccount.com"
```

You can see them at [Settings → Secrets and variables → Actions → Variables](https://github.com/KrishKoria/dear-sky/settings/variables/actions). There are no secrets to add.

### 9. Claude: push, and watch the first automatic deploy

Pushing `main` starts the workflow. Claude follows it with `gh run watch` and reports back. If the deploy identity is missing a permission, the log names it, and Claude gives you the one Cloud Shell line that adds it.

### 10. You: switch App Check on, a day or so later

[Firebase console → App Check](https://console.firebase.google.com/project/hybridai-785bb/appcheck) → **APIs** tab: once **Cloud Firestore** shows most requests as verified, press **Enforce** (it takes up to 15 minutes to apply). Firebase AI Logic already requires App Check (Google made it mandatory from 2026-11-02), which is why steps 3 and 4 must be done before the cloud path works live. Leave Authentication unenforced.

## Every day after that

- Push to `main`, and the site, the function and the Firestore rules update in a few minutes. Watch it under the repo's **Actions** tab.
- A red run means nothing changed on the live site from the failed step onward. Fix and push again.
- **Undo a bad site release:** Firebase console → Hosting → Release history → the previous release → Roll back. For the function or rules, revert the commit and push.
