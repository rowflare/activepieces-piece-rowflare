#!/usr/bin/env bash
# Builds the piece inside an Activepieces source checkout, the only supported way to build a piece:
# the CLI bundles @activepieces/* libraries into the piece, and those libraries are not published to npm.
#
# Usage: scripts/build-in-monorepo.sh <path to activepieces checkout>
# Result: piece/dist inside this repository holds the bundled package (package.json, src/index.js)
#         and the packed archive rowflare-piece-rowflare-<version>.tgz.
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
ap_root="$(cd "${1:?path to an activepieces checkout is required}" && pwd)"
target="$ap_root/packages/pieces/community/rowflare"
package_name="$(node -p "require('$repo_root/piece/package.json').name")"

rm -rf "$target"
mkdir -p "$target"
cp -R "$repo_root/piece/." "$target/"
rm -rf "$target/dist" "$target/node_modules"

# Register the piece in tsconfig.base.json (the build fails without the path mapping).
node - "$ap_root/tsconfig.base.json" "$package_name" <<'EOF'
const fs = require('fs');
const [file, name] = process.argv.slice(2);
const text = fs.readFileSync(file, 'utf8');
if (!text.includes(`"${name}"`)) {
  const entry = `"${name}": ["packages/pieces/community/rowflare/src/index.ts"],`;
  fs.writeFileSync(file, text.replace(/"paths": \{\s*\n/, (m) => `${m}      ${entry}\n`));
}
EOF

cd "$ap_root"
bun install
npx turbo run build --filter="$package_name"
npx turbo run lint --filter="$package_name"
npm run build-piece rowflare

rm -rf "$repo_root/piece/dist"
cp -R "$target/dist" "$repo_root/piece/dist"
# npm adds README and LICENSE to the package when they sit next to package.json.
cp "$repo_root/README.md" "$repo_root/LICENSE" "$repo_root/piece/dist/"
ls -l "$repo_root/piece/dist"
