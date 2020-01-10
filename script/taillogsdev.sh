set -x

gcloud app logs tail --service=default --version="$USER"-dev
