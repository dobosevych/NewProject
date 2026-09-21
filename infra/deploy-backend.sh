#!/usr/bin/env bash
# Deploys the backend and its database to AWS. Run via `make deploy-backend`,
# which loads the AWS credentials and settings from .env.
set -euo pipefail

# Everything runs inside main so bash parses the whole file before starting. Otherwise
# editing the script (or a git pull) during a long deploy makes bash resume mid-file.
main() {
  cd "$(dirname "$0")/.."
  source infra/common.sh

  EC2_INSTANCE_TYPE="${EC2_INSTANCE_TYPE:-t3.micro}"
  CORS_ORIGINS_AWS="${CORS_ORIGINS_AWS:-http://localhost:5173}"
  PASSWORD_PARAM="/$APP_NAME/db-password"

  # Git SHA, plus a timestamp when backend/ has uncommitted changes (ECR tags are immutable).
  TAG="$(git rev-parse --short HEAD)"
  if [ -n "$(git status --porcelain -- backend)" ]; then
    TAG="$TAG-dirty-$(date +%Y%m%d%H%M%S)"
  fi

  account="$(aws sts get-caller-identity --query Account --output text)"
  echo "==> Deploying '$APP_NAME' backend $TAG to account $account in $AWS_REGION"

  echo "==> [1/6] Database password ($PASSWORD_PARAM)"
  if aws ssm get-parameter --name "$PASSWORD_PARAM" >/dev/null 2>&1; then
    echo "    exists, keeping it"
  else
    # Hex only, so it can go into DATABASE_URL without escaping.
    aws ssm put-parameter --name "$PASSWORD_PARAM" --type SecureString \
      --value "$(openssl rand -hex 24)" >/dev/null
    echo "    created"
  fi

  echo "==> [2/6] Container registry ($ECR_STACK)"
  aws cloudformation deploy \
    --stack-name "$ECR_STACK" \
    --template-file infra/ecr.yaml \
    --parameter-overrides "AppName=$APP_NAME" \
    --no-fail-on-empty-changeset
  repository="$(output "$ECR_STACK" RepositoryUri)"
  image="$repository:$TAG"

  echo "==> [3/6] Build and push $image"
  if aws ecr describe-images --repository-name "$APP_NAME-backend" --image-ids "imageTag=$TAG" >/dev/null 2>&1; then
    echo "    already in ECR, skipping"
  else
    # The free-tier instance types are x86_64.
    docker build --platform linux/amd64 --tag "$image" backend
    aws ecr get-login-password | docker login --username AWS --password-stdin "${repository%%/*}"
    docker push "$image"
  fi

  echo "==> [4/6] Backend + database ($BACKEND_STACK)"
  echo "    The first run creates the RDS database and takes about 10-15 minutes."
  aws cloudformation deploy \
    --stack-name "$BACKEND_STACK" \
    --template-file infra/backend.yaml \
    --capabilities CAPABILITY_IAM \
    --parameter-overrides \
      "AppName=$APP_NAME" \
      "ImageUri=$image" \
      "InstanceType=$EC2_INSTANCE_TYPE" \
      "CorsOrigins=$CORS_ORIGINS_AWS" \
    --no-fail-on-empty-changeset
  instance="$(output "$BACKEND_STACK" InstanceId)"
  api_url="$(output "$BACKEND_STACK" ApiUrl)"

  echo "==> [5/6] Restart the container on $instance"
  for _ in $(seq 60); do
    status="$(aws ssm describe-instance-information \
      --filters "Key=InstanceIds,Values=$instance" \
      --query 'InstanceInformationList[0].PingStatus' --output text)"
    [ "$status" = "Online" ] && break
    sleep 5
  done
  [ "$status" = "Online" ] || { echo "Instance $instance never came online in SSM" >&2; exit 1; }

  command_id="$(aws ssm send-command \
    --instance-ids "$instance" \
    --document-name AWS-RunShellScript \
    --comment "deploy $TAG" \
    --parameters 'commands=["cloud-init status --wait >/dev/null","/opt/app/run.sh"]' \
    --query Command.CommandId --output text)"
  # Poll instead of `aws ssm wait`, which gives up after ~100 s (first boot can take longer).
  for _ in $(seq 120); do
    sleep 5
    result="$(aws ssm get-command-invocation --command-id "$command_id" --instance-id "$instance" \
      --query Status --output text 2>/dev/null || echo Pending)"
    case "$result" in Pending | InProgress | Delayed) continue ;; *) break ;; esac
  done
  if [ "$result" != "Success" ]; then
    echo "Restart failed ($result):" >&2
    aws ssm get-command-invocation --command-id "$command_id" --instance-id "$instance" \
      --query '[StandardOutputContent, StandardErrorContent]' --output text >&2
    exit 1
  fi

  echo "==> [6/6] Wait for $api_url/health"
  for _ in $(seq 36); do
    if curl -fsS --max-time 5 "$api_url/health" >/dev/null 2>&1; then
      echo
      echo "API:  $api_url"
      echo "Docs: $(output "$BACKEND_STACK" DocsUrl)"
      exit 0
    fi
    sleep 5
  done
  echo "Backend did not become healthy. Logs: aws logs tail /$APP_NAME/backend --follow" >&2
  exit 1
}

main "$@"
