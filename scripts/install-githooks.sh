#!/bin/sh
# Install version-controlled hooks into this clone's .git/hooks/
set -e

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  exit 0
fi

root="$(git rev-parse --show-toplevel)"
cd "$root"

gitdir="$(git rev-parse --git-dir)"
case "$gitdir" in
  /*) ;;
  *) gitdir="$root/$gitdir" ;;
esac

hookdir="$gitdir/hooks"
mkdir -p "$hookdir"
chmod +x .githooks/pre-push
ln -sf "$root/.githooks/pre-push" "$hookdir/pre-push"

echo "Installed pre-push hook ($hookdir/pre-push -> .githooks/pre-push)"
