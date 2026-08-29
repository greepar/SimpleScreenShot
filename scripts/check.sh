#!/bin/sh
# SPDX-License-Identifier: Apache-2.0 OR GPL-3.0-or-later
set -eu

project_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
test_output="${XDG_RUNTIME_DIR:-/tmp}/simple-screenshot-editor-test.png"

cd "$project_dir"

glib-compile-schemas --strict --dry-run extension/schemas

for file in $(find extension -name '*.js' -type f | sort); do
    node --check "$file"
done

node tests/geometry.test.mjs
node tests/keybinding.test.mjs
gjs -m extension/editor/main.js --self-test tests/fixture.svg "$test_output"

mkdir -p dist
gnome-extensions pack --force --out-dir dist \
    --extra-source=capture.js \
    --extra-source=geometry.js \
    --extra-source=i18n.js \
    --extra-source=indicator.js \
    --extra-source=overlay.js \
    --extra-source=editor \
    extension >/dev/null
zip -q -j dist/simple-screenshot@local.shell-extension.zip \
    LICENSE LICENSE-APACHE LICENSE-GPL NOTICE

for required in capture.js overlay.js editor/main.js editor/canvas.js \
    LICENSE LICENSE-APACHE LICENSE-GPL NOTICE; do
    if ! unzip -Z1 dist/simple-screenshot@local.shell-extension.zip | grep -qx "$required"; then
        printf '%s\n' "Missing packaged source: $required" >&2
        exit 1
    fi
done

printf '%s\n' 'All checks passed.'
