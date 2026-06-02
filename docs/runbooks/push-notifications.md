# Push Notifications — Operational Runbook

How to enable, schedule, monitor, and roll back the weekly push job.

## 1. Set the cron secret

The `/api/notifications/send-weekly` endpoint is guarded by a shared secret
compared in the `X-Cron-Secret` header. Generate one and configure it
in two places:

```bash
# Local development (.env in api-service/)
CRON_SECRET=<some-long-random-string>

# Cloud Run (one-time, via gcloud)
gcloud run services update playnxt-api \
  --region <region> \
  --update-env-vars CRON_SECRET=<some-long-random-string>
```

Pick something unguessable (e.g. `openssl rand -hex 32`).

## 2. Schedule the weekly send

### Option A — Google Cloud Scheduler (recommended)

```bash
gcloud scheduler jobs create http playnxt-weekly-digest \
  --location <region> \
  --schedule "0 17 * * 6" \
  --time-zone "UTC" \
  --uri "https://<cloud-run-url>/api/notifications/send-weekly" \
  --http-method POST \
  --headers "X-Cron-Secret=<the-secret>"
```

`0 17 * * 6` = Saturday 17:00 UTC (a generally good window for U.S. evenings).
Adjust to taste.

To pause:
```bash
gcloud scheduler jobs pause playnxt-weekly-digest --location <region>
```

To resume / delete: swap `pause` for `resume` / `delete`.

### Option B — GitHub Actions cron (fallback)

If Cloud Scheduler is unavailable, add `.github/workflows/weekly-push.yml`:

```yaml
name: weekly-push
on:
  schedule:
    - cron: '0 17 * * 6'
  workflow_dispatch:
jobs:
  send:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger weekly send
        run: |
          curl -fsS -X POST \
            -H "X-Cron-Secret: ${{ secrets.CRON_SECRET }}" \
            https://<cloud-run-url>/api/notifications/send-weekly
```

Set the `CRON_SECRET` repository secret to the same value.

## 3. Manual test

```bash
curl -i -X POST \
  -H "X-Cron-Secret: $CRON_SECRET" \
  https://<cloud-run-url>/api/notifications/send-weekly
```

Expected: `200 OK` with body `{"digest_sent": N, "reengagement_sent": M}`.

A wrong / missing secret returns `403`.

## 4. End-to-end smoke test (device required)

Expo Push tokens require a real device + an EAS dev/preview build (Expo Go
on SDK 53+ does not support remote push).

1. Install an EAS dev build on a physical device.
2. Accept any recommendation in the app. The "Stay in the loop?" alert appears.
   Tap **Enable** → grant the OS permission.
3. In Firestore, confirm a doc was created in `devices/` with
   `notifications_enabled=true` and a populated `expo_push_token`.
4. Trigger the send with the manual `curl` above. Expect the device to
   receive a push within seconds.
5. Tap the notification. Confirm the app opens to the **What's New** screen.

## 5. Frequency cap

The 7-day cap is enforced server-side in `select_recipients` via
`last_notified_at`. A Scheduler double-fire within 7 days cannot
double-send. Safe to retrigger manually for testing — devices that already
received a push this week will be excluded automatically.

## 6. Invalid token cleanup

The send job parses Expo tickets and deletes any token returning
`DeviceNotRegistered`. No manual cleanup required.

## 7. Rolling back

- **Pause sending only:** pause the Scheduler job (or disable the workflow).
- **Disable the endpoint entirely:** unset `CRON_SECRET` on Cloud Run. All
  callers will receive `403`.
- **Remove a single device:** delete its doc from `devices/` in Firestore.
- **Stop a runaway feature flag:** there is no client kill-switch in v1; the
  Profile toggle is the user-facing opt-out.
