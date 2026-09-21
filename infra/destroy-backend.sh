#!/usr/bin/env bash
# Deletes the backend stacks. The database is kept as a final RDS snapshot
# (DeletionPolicy: Snapshot); snapshot storage beyond the free 20 GB is billed.
set -euo pipefail

# Everything runs inside main so bash parses the whole file before starting. Otherwise
# editing the script (or a git pull) during a long deploy makes bash resume mid-file.
main() {
  cd "$(dirname "$0")/.."
  source infra/common.sh

  if stack_exists "$FRONTEND_STACK"; then
    echo "Note: $FRONTEND_STACK still exists and will serve /api/* errors until you run make destroy-frontend."
  fi
  read -r -p "Delete stacks $APP_NAME-backend and $APP_NAME-ecr in $AWS_REGION? Type the app name to confirm: " answer
  [ "$answer" = "$APP_NAME" ] || { echo "Aborted."; exit 1; }

  echo "==> Deleting $APP_NAME-backend (takes several minutes)"
  aws cloudformation delete-stack --stack-name "$BACKEND_STACK"
  aws cloudformation wait stack-delete-complete --stack-name "$BACKEND_STACK"

  echo "==> Deleting images and $APP_NAME-ecr"
  aws ecr delete-repository --repository-name "$BACKEND_STACK" --force >/dev/null 2>&1 || true
  aws cloudformation delete-stack --stack-name "$ECR_STACK"
  aws cloudformation wait stack-delete-complete --stack-name "$ECR_STACK"

  echo "Done."
  echo "Kept: the final database snapshot (restoring it needs the password in /$APP_NAME/db-password)."
  echo "  aws rds describe-db-snapshots --db-instance-identifier $APP_NAME-db"
  echo "  aws ssm delete-parameter --name /$APP_NAME/db-password   # once you no longer need it"
}

main "$@"
