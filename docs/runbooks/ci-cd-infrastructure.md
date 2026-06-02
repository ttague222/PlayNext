# CI/CD Infrastructure — Operational Runbook

What was set up on 2026-06-02 to make `API Deploy` work, where it lives, and
how to debug if it breaks.

## Architecture

GitHub Actions → Workload Identity Federation → Google Cloud → Cloud Run

The workflow `.github/workflows/api-deploy.yml` runs on push to `main` when
`api-service/**` changes. It authenticates to GCP using **Workload Identity
Federation** (no service-account JSON keys to manage or rotate), then runs
`gcloud run deploy --source api-service` against the `playnxt-api` Cloud Run
service in `us-central1`.

## GCP resources

| Resource | Name | Purpose |
|---|---|---|
| Service Account | `github-actions-deploy@playnxt-1a2c6.iam.gserviceaccount.com` | Identity that GitHub Actions impersonates to deploy |
| Workload Identity Pool | `github-actions` (global) | WIF pool that trusts GitHub OIDC tokens |
| Workload Identity Provider | `github-actions/providers/github` | The OIDC provider inside the pool; issuer `https://token.actions.githubusercontent.com` |
| Cloud Run service | `playnxt-api` (us-central1) | The deployed app |
| Runtime SA | `167253232570-compute@developer.gserviceaccount.com` | Cloud Run's default compute SA; reads injected secrets at container startup |

### Deploy SA roles (project-level)

The deploy SA needs these on the `playnxt-1a2c6` project:
- `roles/run.admin` — deploy Cloud Run services
- `roles/iam.serviceAccountUser` — act as the runtime SA
- `roles/storage.admin` — push source archives to GCS during build
- `roles/cloudbuild.builds.editor` — submit builds via Cloud Build
- `roles/secretmanager.secretAccessor` — verify secret references at deploy time
- `roles/artifactregistry.writer` — push container images
- `roles/logging.logWriter` — write deploy logs

### Runtime SA roles

The default compute SA needs `roles/secretmanager.secretAccessor` at the
project level so the running container can fetch the secrets injected via
`--set-secrets` (currently `SENDGRID_API_KEY` and `CRON_SECRET`).

### WIF principal binding

The repo `ttague222/PlayNext` is bound to impersonate the deploy SA via
`roles/iam.workloadIdentityUser` on the SA. Principal expression:

```
principalSet://iam.googleapis.com/projects/167253232570/locations/global/workloadIdentityPools/github-actions/attribute.repository/ttague222/PlayNext
```

## GitHub repo secrets

Two secrets on the `ttague222/PlayNext` repo:

| Secret | Value |
|---|---|
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | `projects/167253232570/locations/global/workloadIdentityPools/github-actions/providers/github` |
| `GCP_SERVICE_ACCOUNT` | `github-actions-deploy@playnxt-1a2c6.iam.gserviceaccount.com` |

## Secret Manager secrets

| Secret | Used by | Source of truth |
|---|---|---|
| `SENDGRID_API_KEY` | API container at runtime | SendGrid dashboard (needs rotation — see playnxt.md memory) |
| `CRON_SECRET` | API container at runtime + Cloud Scheduler | Generated via `python -c "import secrets; print(secrets.token_hex(32))"`; retrievable with `gcloud secrets versions access latest --secret=CRON_SECRET` |
| `FIREBASE_WEB_API_KEY` | Web Admin Docker build (baked into SPA bundle) | Firebase console → playnxt-1a2c6 → Project settings → Web app → apiKey |

## Workflow env-var layout

`--set-env-vars` on deploy:
- `ENVIRONMENT=production`
- `FIREBASE_PROJECT_ID=playnxt-1a2c6` (required — Firebase init crashes without it; Cloud Run uses ADC, no JSON key needed)
- `SUPPORT_EMAIL`, `FROM_EMAIL` — both `support@watchlightinteractive.com`
- `PYTHONUNBUFFERED=1`

`--set-secrets`:
- `SENDGRID_API_KEY=SENDGRID_API_KEY:latest`
- `CRON_SECRET=CRON_SECRET:latest`

## Web Admin build args

`web-admin/cloudbuild.yaml` substitutions passed by the workflow:

- `_FB_KEY` — fetched at deploy time via `gcloud secrets versions access latest --secret=FIREBASE_WEB_API_KEY`, then passed as `--build-arg VITE_FIREBASE_API_KEY=...` to Docker. All other `VITE_*` values are hardcoded as `ARG` defaults in the Dockerfile and need no override.
- `_IMAGE` — `gcr.io/playnxt-1a2c6/playnxt-web-admin:<git-sha>` (constructed by the workflow)

No runtime `--set-env-vars` or `--set-secrets` on the Cloud Run service — the SPA is static nginx; config is baked in at build time.

## Cloud Scheduler

| Job | Schedule | Target |
|---|---|---|
| `playnxt-weekly-digest` (us-central1) | `0 17 * * 6` UTC (Saturday 17:00) | `POST https://playnxt-api-167253232570.us-central1.run.app/api/notifications/send-weekly` with `X-Cron-Secret` header |

The header value is the same `CRON_SECRET` the API container has — the
endpoint compares the request header against `settings.cron_secret` in
constant time. Wrong/missing header → 403.

To pause: `gcloud scheduler jobs pause playnxt-weekly-digest --location=us-central1`
To resume: `gcloud scheduler jobs resume playnxt-weekly-digest --location=us-central1`
To fire manually: `gcloud scheduler jobs run playnxt-weekly-digest --location=us-central1`

## Debugging

### Deploy fails at `Authenticate to Google Cloud`
- Check the repo secrets are set: `gh secret list`
- Check the provider exists: `gcloud iam workload-identity-pools providers describe github --location=global --workload-identity-pool=github-actions`
- Check the SA binding has the right principalSet (case-sensitive repo name)

### Deploy fails at `Deploy to Cloud Run` with "Permission denied"
- Confirm the deploy SA has the 7 roles listed above
- For secret refs: confirm the *runtime* SA (default compute) has `secretmanager.secretAccessor`

### Container fails to start after deploy
- Check Cloud Run logs: `gcloud logging read 'resource.type=cloud_run_revision AND resource.labels.service_name="playnxt-api"' --limit=20`
- The previous healthy revision continues to serve 100% of traffic when a new revision fails to become ready — no outage, but no new code either
- Most common cause: missing `FIREBASE_PROJECT_ID` env var

### Cloud Scheduler doesn't trigger
- Verify the API is enabled: `gcloud services list --enabled | grep cloudscheduler`
- Check the job is enabled: `gcloud scheduler jobs describe playnxt-weekly-digest --location=us-central1`

## What's NOT set up (intentionally)

- **Mobile Build workflow** (`.github/workflows/mobile-build.yml`): correct YAML, but needs `EXPO_TOKEN` GitHub secret to authenticate to EAS. Generate a personal access token at https://expo.dev/settings/access-tokens (from the account that owns the PlayNxt EAS project), then: `gh secret set EXPO_TOKEN --body "<token>"`. The workflow will then build a `preview` profile (internal distribution) on every push to `mobile-app/**`. Production submission stays manual-only via `workflow_dispatch`.
- **`FIREBASE_WEB_API_KEY` Secret Manager entry**: web-admin-deploy.yml is fixed but will fail the `Fetch Firebase Web API key` step until this secret exists. See instructions in the Web Admin build args section above.
- **Workload identity for Mobile**: Mobile Build uses EAS (not GCP), so no WIF needed there. Web Admin Deploy reuses the existing WIF pool and deploy SA — no new WIF config required.
