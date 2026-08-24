// SPDX-License-Identifier: Apache-2.0 OR GPL-3.0-or-later

import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk?version=4.0';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

function addSwitch(group, settings, key, title, subtitle) {
    const row = new Adw.SwitchRow({title, subtitle});
    settings.bind(key, row, 'active', Gio.SettingsBindFlags.DEFAULT);
    group.add(row);
    return row;
}

export default class SimpleScreenshotPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        window.set_default_size(680, 720);
        window.search_enabled = true;

        const general = new Adw.PreferencesPage({
            title: 'General',
            icon_name: 'preferences-system-symbolic',
        });
        window.add(general);

        const behavior = new Adw.PreferencesGroup({title: 'Capture behavior'});
        general.add(behavior);
        addSwitch(behavior, settings, 'copy-to-clipboard',
            'Copy to clipboard', 'Make every new capture immediately pasteable');
        addSwitch(behavior, settings, 'save-copies',
            'Save a copy', 'Keep the original capture before editing');
        addSwitch(behavior, settings, 'show-notification',
            'Show preview notification', 'Click the notification to open the editor');
        addSwitch(behavior, settings, 'auto-open-editor',
            'Open editor after capture', 'Skip the notification-only workflow');
        addSwitch(behavior, settings, 'include-pointer',
            'Include mouse pointer', 'Draw the current pointer into the image');
        addSwitch(behavior, settings, 'show-indicator',
            'Show top-panel button', 'Keep capture commands in the system panel');

        const capture = new Adw.PreferencesGroup({title: 'Capture controls'});
        general.add(capture);

        const shortcut = new Adw.EntryRow({
            title: 'Keyboard shortcut',
            text: settings.get_strv('shortcut')[0] ?? '',
        });
        shortcut.add_suffix(new Gtk.Image({icon_name: 'input-keyboard-symbolic'}));
        shortcut.connect('apply', () => {
            const value = shortcut.text.trim();
            settings.set_strv('shortcut', value ? [value] : []);
        });
        shortcut.connect('notify::text', () => {
            const value = shortcut.text.trim();
            if (value)
                settings.set_strv('shortcut', [value]);
        });
        capture.add(shortcut);

        const modeModel = Gtk.StringList.new([
            'Rectangular snip', 'Window snip', 'Full-screen snip',
        ]);
        const modeRow = new Adw.ComboRow({
            title: 'Default mode',
            model: modeModel,
            selected: Math.max(0, ['region', 'window', 'screen']
                .indexOf(settings.get_string('default-mode'))),
        });
        modeRow.connect('notify::selected', () => {
            settings.set_string('default-mode',
                ['region', 'window', 'screen'][modeRow.selected]);
        });
        capture.add(modeRow);

        const storage = new Adw.PreferencesPage({
            title: 'Storage',
            icon_name: 'folder-pictures-symbolic',
        });
        window.add(storage);
        const files = new Adw.PreferencesGroup({title: 'Files and history'});
        storage.add(files);

        const directoryRow = new Adw.ActionRow({
            title: 'Save directory',
            subtitle: settings.get_string('save-directory') || 'Pictures/Screenshots',
        });
        const chooseDirectory = new Gtk.Button({
            label: 'Choose…',
            valign: Gtk.Align.CENTER,
        });
        chooseDirectory.connect('clicked', () => {
            const dialog = new Gtk.FileDialog({title: 'Choose screenshot directory'});
            dialog.select_folder(window, null, (_dialog, result) => {
                try {
                    const folder = dialog.select_folder_finish(result);
                    settings.set_string('save-directory', folder.get_path());
                    directoryRow.subtitle = folder.get_path();
                } catch (error) {
                    if (!error.matches(Gtk.DialogError, Gtk.DialogError.DISMISSED))
                        console.error(error.message);
                }
            });
        });
        directoryRow.add_suffix(chooseDirectory);
        directoryRow.activatable_widget = chooseDirectory;
        files.add(directoryRow);

        const filename = new Adw.EntryRow({
            title: 'Filename pattern',
            text: settings.get_string('filename-pattern'),
        });
        filename.connect('notify::text', () =>
            settings.set_string('filename-pattern', filename.text));
        files.add(filename);

        const history = Adw.SpinRow.new_with_range(1, 200, 1);
        history.title = 'History limit';
        history.subtitle = 'Maximum captures listed in the editor';
        settings.bind('history-limit', history, 'value', Gio.SettingsBindFlags.DEFAULT);
        files.add(history);
    }
}
