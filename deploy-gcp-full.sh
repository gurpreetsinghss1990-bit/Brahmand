#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ID="${1:-}"
REGION="${REGION:-us-central1}"
BACKEND_SERVICE="${BACKEND_SERVICE:-brahmand-backend}"
FRONTEND_SERVICE="${FRONTEND_SERVICE:-brahmand-frontend}"

if [[ -z "$PROJECT_ID" ]]; then
  if [[ -f "$ROOT_DIR/.gcp_project_id" ]]; then
    PROJECT_ID="$(cat "$ROOT_DIR/.gcp_project_id")"
  else
    echo "Usage: ./deploy-gcp-full.sh <gcp-project-id>"
    exit 1
  fi
fi

echo "Using project: $PROJECT_ID"
gcloud config set project "$PROJECT_ID" >/dev/null

echo "Enabling required APIs..."
if ! gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com --project "$PROJECT_ID"; then
  echo "Failed to enable services. Billing may not be linked."
  echo "Open: https://console.cloud.google.com/billing/linkedaccount?project=$PROJECT_ID"
  exit 1
fi

echo "Preparing backend env vars file from backend/.env..."
ROOT_DIR_PY="$ROOT_DIR" python3 - <<'PY'
from pathlib import Path
import json
import os

root = Path(os.environ["ROOT_DIR_PY"]).resolve()
env_path = root / "backend" / ".env"
out_path = root / "backend" / ".gcloud.env.yaml"

items = {}
for raw in env_path.read_text().splitlines():
    line = raw.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    key, value = line.split("=", 1)
    items[key.strip()] = value.strip().strip('"').strip("'")

lines = [f"{k}: {json.dumps(v)}" for k, v in items.items()]
out_path.write_text("\n".join(lines) + "\n")
print(f"Wrote {out_path}")
PY

echo "Deploying backend Cloud Run service..."
gcloud run deploy "$BACKEND_SERVICE" \
  --source "$ROOT_DIR/backend" \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --allow-unauthenticated \
  --env-vars-file "$ROOT_DIR/backend/.gcloud.env.yaml"

BACKEND_URL="$(gcloud run services describe "$BACKEND_SERVICE" --project "$PROJECT_ID" --region "$REGION" --format='value(status.url)')"
echo "Backend URL: $BACKEND_URL"

echo "Building frontend web bundle with preserved env and updated backend URL..."
FRONTEND_DIR="$ROOT_DIR/frontend"
ENV_FILE="$FRONTEND_DIR/.env"
TMP_BAK="$FRONTEND_DIR/.env.deploy.bak"

cp "$ENV_FILE" "$TMP_BAK"
trap 'if [[ -f "$TMP_BAK" ]]; then mv "$TMP_BAK" "$ENV_FILE"; fi' EXIT
python3 - <<PY
from pathlib import Path

env_file = Path(r"$ENV_FILE")
backend_url = r"$BACKEND_URL"
lines = env_file.read_text().splitlines()
out = []
seen = False
for line in lines:
    if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
        out.append(f"EXPO_PUBLIC_BACKEND_URL={backend_url}")
        seen = True
    else:
        out.append(line)
if not seen:
    out.append(f"EXPO_PUBLIC_BACKEND_URL={backend_url}")
env_file.write_text("\n".join(out) + "\n")
PY

pushd "$FRONTEND_DIR" >/dev/null
rm -rf .expo .metro-cache
EXPO_PUBLIC_BACKEND_URL="$BACKEND_URL" npx expo export -p web --clear

echo "Validating compiled frontend backend URL..."
if ! grep -R --binary-files=without-match "$BACKEND_URL" dist >/dev/null; then
  echo "ERROR: Compiled frontend does not contain expected backend URL: $BACKEND_URL"
  exit 1
fi
if grep -R --binary-files=without-match "loca.lt" dist >/dev/null; then
  echo "ERROR: Compiled frontend still contains loca.lt URLs. Aborting deploy."
  exit 1
fi
popd >/dev/null

mv "$TMP_BAK" "$ENV_FILE"
trap - EXIT

echo "Deploying frontend Cloud Run service..."
DEPLOY_FRONTEND_DIR="$ROOT_DIR/.deploy/frontend-cloudrun"
rm -rf "$DEPLOY_FRONTEND_DIR"
mkdir -p "$DEPLOY_FRONTEND_DIR"
cp -R "$FRONTEND_DIR/dist" "$DEPLOY_FRONTEND_DIR/dist"
cp "$FRONTEND_DIR/Dockerfile" "$DEPLOY_FRONTEND_DIR/Dockerfile"
cp "$FRONTEND_DIR/nginx.conf" "$DEPLOY_FRONTEND_DIR/nginx.conf"

gcloud run deploy "$FRONTEND_SERVICE" \
  --source "$DEPLOY_FRONTEND_DIR" \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --allow-unauthenticated

FRONTEND_URL="$(gcloud run services describe "$FRONTEND_SERVICE" --project "$PROJECT_ID" --region "$REGION" --format='value(status.url)')"

echo ""
echo "Deployment complete"
echo "Project: $PROJECT_ID"
echo "Backend: $BACKEND_URL"
echo "Frontend: $FRONTEND_URL"