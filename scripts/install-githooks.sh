#!/bin/sh
# Point this clone at the version-controlled hooks in .githooks/
set -e

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  exit 0
fi

root="$(git rev-parse --show-toplevel)"
cd "$root"
git config core.hooksPath .githooks
echo "Installed git hooks from .githooks/"
