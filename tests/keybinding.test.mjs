// SPDX-License-Identifier: Apache-2.0 OR GPL-3.0-or-later

import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

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
    /<key name="simple-screenshot-open-overlay" type="as">[\s\S]*?<default>\['&lt;Control&gt;&lt;Alt&gt;a']<\/default>/,
    'Ctrl + Alt + A is the requested shortcut'
);

// Exercise registration with the same Shell mode values used by GNOME 46.
const ActionMode = {NORMAL: 1, OVERVIEW: 2, LOCK_SCREEN: 4, POPUP: 128};
let binding;
const settings = {
    get_user_value: () => null,
    get_boolean: () => false,
    connect: () => 1,
};
const context = {
    Extension: class { getSettings() { return settings; } },
    CaptureService: class {},
    Meta: {KeyBindingFlags: {IGNORE_AUTOREPEAT: 1}},
    Shell: {ActionMode},
    Main: {wm: {addKeybinding: (...args) => { binding = args; }}},
};
vm.runInNewContext(extensionSource
    .replace(/^import .*;\n/gm, '')
    .replace('export default class', 'globalThis.TestExtension = class'), context);
const extension = new context.TestExtension();
extension.enable();
assert.equal(binding[0], shortcutName);
for (const mode of [ActionMode.NORMAL, ActionMode.OVERVIEW, ActionMode.POPUP])
    assert.ok(binding[3] & mode, `Capture must be available in Shell mode ${mode}`);
assert.equal(binding[3] & ActionMode.LOCK_SCREEN, 0);
let opened = false;
extension.openOverlay = () => { opened = true; };
binding[4]();
assert.ok(opened, 'The registered shortcut must open the capture overlay');

console.log('keybinding tests passed');
