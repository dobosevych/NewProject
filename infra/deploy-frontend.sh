#!/usr/bin/env bash
# Builds the frontend and deploys it to S3 + CloudFront. Run via `make deploy-frontend`
# after `make deploy-backend` (CloudFront forwards /api/* to the backend).
set -euo pipefail

# Everything runs inside main so bash parses the whole file before starting. Otherwise
# editing the script (or a git pull) during a long deploy makes bash resume mid-file.
main() {
  cd "$(dirname "$0")/.."
  source infra/common.sh

  stack_exists "$BACKEND_STACK" || { echo "Stack $BACKEND_STACK not found; run make deploy-backend first." >&2; exit 1; }
  backend_domain="$(output "$BACKEND_STACK" ApiDomain)"

  echo "==> [1/4] Build the frontend"
  (cd frontend && npm ci && npm run build)

  echo "==> [2/4] S3 bucket + CloudFront ($FRONTEND_STACK, backend: $backend_domain)"
  echo "    The first run creates the CloudFront distribution and takes about 5 minutes."
  aws cloudformation deploy \
    --stack-name "$FRONTEND_STACK" \
    --template-file infra/frontend.yaml \
    --parameter-overrides "AppName=$APP_NAME" "BackendDomain=$backend_domain" \
    --tags "${STACK_TAGS[@]}" \
    --no-fail-on-empty-changeset
  bucket="$(output "$FRONTEND_STACK" BucketName)"
  distribution="$(output "$FRONTEND_STACK" DistributionId)"

  echo "==> [3/4] Upload to s3://$bucket"
  # Hashed assets never change, so browsers may cache them forever; everything else is revalidated.
  aws s3 sync frontend/dist/assets "s3://$bucket/assets" --delete \
    --cache-control "public, max-age=31536000, immutable"
  aws s3 sync frontend/dist "s3://$bucket" --delete --exclude "assets/*" \
    --cache-control "no-cache"

  echo "==> [4/4] Invalidate the CloudFront cache"
  # "/*" counts as a single path against the 1,000 free invalidation paths per month.
  invalidation="$(aws cloudfront create-invalidation --distribution-id "$distribution" \
    --paths "/*" --query Invalidation.Id --output text)"
  aws cloudfront wait invalidation-completed --distribution-id "$distribution" --id "$invalidation"

  echo
  echo "App: $(output "$FRONTEND_STACK" AppUrl)"
}

main "$@"
