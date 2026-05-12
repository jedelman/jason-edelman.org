#!/bin/sh
# Install git hooks from scripts/ into .git/hooks/
# Run once after cloning: sh scripts/install-hooks.sh

HOOK=".git/hooks/pre-commit"
cat > "$HOOK" << 'HOOK_CONTENT'
#!/bin/sh
node scripts/pre-commit.mjs
HOOK_CONTENT
chmod +x "$HOOK"
echo "✓ pre-commit hook installed"
