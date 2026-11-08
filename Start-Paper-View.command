#!/bin/zsh
# Launch directly from Finder/Terminal so model requests use the Mac's network access.
cd -- "$(dirname -- "$0")" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v npm >/dev/null 2>&1; then
  echo "Node.js/npm is required. Install Node.js, then open this launcher again."
  read -r "?Press Return to close."
  exit 1
fi
printf '\nStarting Paper View at http://127.0.0.1:3111/\nKeep this Terminal window open. Press Control+C to stop.\n\n'
exec npm run dev:app
