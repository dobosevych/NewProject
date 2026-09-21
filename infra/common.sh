# Shared setup for the infra scripts: credentials and settings come from .env via make.
: "${AWS_ACCESS_KEY_ID:?Set AWS_ACCESS_KEY_ID in .env}"
: "${AWS_SECRET_ACCESS_KEY:?Set AWS_SECRET_ACCESS_KEY in .env}"
: "${AWS_REGION:?Set AWS_REGION in .env}"
export AWS_DEFAULT_REGION="$AWS_REGION" AWS_PAGER=""
[ -n "${AWS_SESSION_TOKEN:-}" ] || unset AWS_SESSION_TOKEN

APP_NAME="${APP_NAME:-meetings}"
ECR_STACK="$APP_NAME-ecr"
BACKEND_STACK="$APP_NAME-backend"
FRONTEND_STACK="$APP_NAME-frontend"

# Every resource is tagged App=<APP_NAME>. Stack tags propagate to all taggable resources
# in the stack; resources created outside CloudFormation are tagged explicitly.
TAG_KEY="App"
STACK_TAGS=("$TAG_KEY=$APP_NAME")

# output STACK KEY: prints one CloudFormation stack output.
output() {
  aws cloudformation describe-stacks --stack-name "$1" \
    --query "Stacks[0].Outputs[?OutputKey=='$2'].OutputValue" --output text
}

stack_exists() {
  aws cloudformation describe-stacks --stack-name "$1" >/dev/null 2>&1
}
