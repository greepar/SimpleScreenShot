#!/bin/sh
# SPDX-License-Identifier: Apache-2.0 OR GPL-3.0-or-later
set -eu

project_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
uuid='simple-screenshot@local'
build_dir="$project_dir/dist"
archive="$build_dir/$uuid.shell-extension.zip"
extension_dir="${XDG_DATA_HOME:-$HOME/.local/share}/gnome-shell/extensions/$uuid"
applications_dir="${XDG_DATA_HOME:-$HOME/.local/share}/applications"

mkdir -p "$build_dir" "$applications_dir"
gnome-extensions pack --force --out-dir "$build_dir" \
    --extra-source=capture.js \
    --extra-source=geometry.js \
    --extra-source=i18n.js \
    --extra-source=indicator.js \
    --extra-source=overlay.js \
    --extra-source=editor \
    "$project_dir/extension"
zip -q -j "$archive" \
    "$project_dir/LICENSE" \
    "$project_dir/LICENSE-APACHE" \
    "$project_dir/LICENSE-GPL" \
    "$project_dir/NOTICE"
gnome-extensions install --force "$archive"

sed "s|@EXTENSION_DIR@|$extension_dir|g" \
    "$project_dir/desktop/io.github.simple_screenshot.Editor.desktop.in" \
    > "$applications_dir/io.github.simple_screenshot.Editor.desktop"

update-desktop-database "$applications_dir" 2>/dev/null || true
gnome-extensions enable "$uuid" 2>/dev/null || true
gjs -c "const Gio=imports.gi.Gio; const s=new Gio.Settings({schema_id:'org.gnome.shell'}); const key='enabled-extensions'; const uuid='$uuid'; const enabled=s.get_strv(key); if (!enabled.includes(uuid)) { enabled.push(uuid); s.set_strv(key, enabled); }"

printf '%s\n' "Installed $uuid"
printf '%s\n' 'If the extension is not visible, log out and back in once.'
