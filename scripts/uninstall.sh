#!/bin/sh
# SPDX-License-Identifier: Apache-2.0 OR GPL-3.0-or-later
set -eu

uuid='simple-screenshot@local'
extension_dir="${XDG_DATA_HOME:-$HOME/.local/share}/gnome-shell/extensions/$uuid"
desktop_file="${XDG_DATA_HOME:-$HOME/.local/share}/applications/io.github.simple_screenshot.Editor.desktop"

gnome-extensions disable "$uuid" 2>/dev/null || true

if [ -e "$extension_dir" ]; then
    gio trash "$extension_dir"
    printf '%s\n' "Moved $extension_dir to Trash"
fi

if [ -e "$desktop_file" ]; then
    gio trash "$desktop_file"
    printf '%s\n' "Moved $desktop_file to Trash"
fi
