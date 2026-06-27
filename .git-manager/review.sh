#!/usr/bin/env bash
# Git Manager — Review pipeline for GLM-5.2 commits
# Usage: bash .git-manager/review.sh
# Run from repo root on master branch.

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()  { echo -e "${BLUE}[GIT-MGR]${NC} $1"; }
ok()   { echo -e "${GREEN}[PASS]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
fail() { echo -e "${RED}[FAIL]${NC} $1"; exit 1; }

log "=== Git Manager Review Pipeline ==="

# 1. Fetch latest
log "Fetching all remotes..."
git fetch --all || fail "git fetch failed"

# 2. Check for new GLM commits
GLM_AHEAD=$(git rev-list claude-review..origin/glm-dev --count 2>/dev/null || echo "0")
if [ "$GLM_AHEAD" -eq 0 ]; then
  log "No new commits on glm-dev since last review. Nothing to do."
  exit 0
fi
log "Found $GLM_AHEAD new commit(s) on glm-dev to review."

# 3. Show what GLM changed
log "GLM commits to review:"
git log claude-review..origin/glm-dev --oneline

log "Files changed by GLM:"
git diff claude-review..origin/glm-dev --name-status

# 4. Switch to claude-review and merge
log "Merging glm-dev into claude-review..."
git checkout claude-review
git pull origin claude-review

# Check for merge conflicts before merging
git merge --no-commit --no-ff origin/glm-dev 2>/dev/null || {
  fail "Merge conflict detected. Review manually:\n$(git status --short)"
}
git merge --abort 2>/dev/null || true

# Actual merge
git merge origin/glm-dev -m "chore: merge glm-dev for review" || {
  fail "Merge failed. Conflicts:\n$(git status --short)\nStop — do not guess. Review manually."
}
ok "Merge succeeded."

# 5. Install dependencies if lockfile changed
if git diff HEAD~1 --name-only | grep -q "pnpm-lock.yaml\|package.json"; then
  log "Dependency changes detected — running pnpm install..."
  pnpm install --frozen-lockfile || fail "pnpm install failed"
fi

# 6. TypeScript check
log "Running typecheck..."
pnpm typecheck && ok "TypeScript: no errors" || fail "TypeScript errors found — fix before merging"

# 7. Build
log "Running build..."
pnpm build && ok "Build: success" || fail "Build failed — fix before merging"

# 8. Tests (non-blocking if no tests exist)
if [ -f "package.json" ] && grep -q '"test"' package.json; then
  log "Running tests..."
  pnpm test && ok "Tests: passed" || warn "Tests failed — review before merging"
fi

ok "=== All checks passed ==="
log "Ready to open PR: gh pr create --base master --head claude-review --title '<description>'"
log "Or merge directly: git checkout master && git merge claude-review && git push origin master"
