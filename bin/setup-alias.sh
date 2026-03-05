#!/bin/bash

# Adds os-figma alias to ~/.zshrc (or ~/.bashrc)

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ALIAS_LINE="alias os-figma='node $REPO_DIR/src/index.js'"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

# Detect shell config file
if [ -n "$ZSH_VERSION" ] || [ "$SHELL" = "/bin/zsh" ]; then
    RC_FILE="$HOME/.zshrc"
else
    RC_FILE="$HOME/.bashrc"
fi

# Check if alias already exists
if grep -q "alias os-figma=" "$RC_FILE" 2>/dev/null; then
    # Update existing alias (path may have changed)
    sed -i '' "/alias os-figma=/d" "$RC_FILE"
fi

# Add alias
echo "" >> "$RC_FILE"
echo "# OutSystems Figma CLI" >> "$RC_FILE"
echo "$ALIAS_LINE" >> "$RC_FILE"

# Save repo path to config
mkdir -p "$HOME/.outsystems-figma-cli"
python3 -c "
import json, os
path = os.path.expanduser('~/.outsystems-figma-cli/config.json')
cfg = {}
if os.path.exists(path):
    with open(path) as f: cfg = json.load(f)
cfg['repoPath'] = '$REPO_DIR'
with open(path, 'w') as f: json.dump(cfg, f, indent=2)
"

echo ""
echo -e "  ${GREEN}Done!${NC} Added ${BOLD}os-figma${NC} alias to ${BOLD}$RC_FILE${NC}"
echo ""
echo -e "  Now run: ${BOLD}source $RC_FILE${NC}"
echo -e "  Then type: ${BOLD}os-figma --help${NC}"
echo ""