#!/usr/bin/env bash
#
# Build the local Optimization SDK and run the Expo iOS app.
#
# Usage:
#   ./scripts/build-and-run.sh          # build SDK + run iOS
#   ./scripts/build-and-run.sh --skip-build   # skip SDK build, just run
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
SDK_MONOREPO="/Users/akfreas/freelance/contentful/optimization"

# ─── Parse flags ──────────────────────────────────────────────────────────────
SKIP_BUILD=false
for arg in "$@"; do
  case "$arg" in
    --skip-build) SKIP_BUILD=true ;;
  esac
done

# ─── NVM ──────────────────────────────────────────────────────────────────────
export NVM_DIR="$HOME/.nvm"
# shellcheck source=/dev/null
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

# ─── Build SDK ────────────────────────────────────────────────────────────────
if [ "$SKIP_BUILD" = false ]; then
  echo "══════════════════════════════════════════════════════════"
  echo "  Building Optimization SDK (react-native package)…"
  echo "══════════════════════════════════════════════════════════"
  cd "$SDK_MONOREPO"
  nvm use

  # Build only the packages needed for react-native (skip web/node).
  pnpm --filter logger \
       --filter @contentful/optimization-api-schemas \
       --filter @contentful/optimization-api-client \
       --filter @contentful/optimization-core \
       --filter @contentful/optimization-react-native \
       --stream build

  echo ""
  echo "  SDK build complete."
  echo ""
fi

# ─── Install dependencies (picks up the file: link) ──────────────────────────
echo "══════════════════════════════════════════════════════════"
echo "  Installing app dependencies…"
echo "══════════════════════════════════════════════════════════"
cd "$APP_DIR"
npm install

# ─── Run the app ──────────────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════════════════"
echo "  Starting Expo iOS…"
echo "══════════════════════════════════════════════════════════"
npx expo run:ios
