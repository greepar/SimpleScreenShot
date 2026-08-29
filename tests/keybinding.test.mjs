// SPDX-License-Identifier: Apache-2.0 OR GPL-3.0-or-later

import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const extensionSource = readFileSync('extension/extension.js', 'utf8');
const schemaSource = readFileSync(
    'extension/schemas/org.gnome.shell.extensions.simple-screenshot.gschema.xml',
    'utf8'
);

const shortcutName = extensionSource.match(
    /const SHORTCUT_KEY = '([^']+)'/
)?.[1];

assert.ok(shortcutName, 'The extension must declare its shortcut key');
assert.notEqual(
    shortcutName,
    'shortcut',
    'A generic keybinding name collides with Ubuntu Dock'
);
assert.ok(
    schemaSource.includes(`<key name="${shortcutName}" type="as">`),
    'The shortcut key must exist in the GSettings schema'
);
assert.match(
    schemaSource,
    /<key name="simple-screenshot-open-overlay" type="as">[\s\S]*?<default>\['&lt;Shift&gt;&lt;Super&gt;s']<\/default>/,
    'Shift + Super + S must remain the default shortcut'
);

console.log('keybinding tests passed');
