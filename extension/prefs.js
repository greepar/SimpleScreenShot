// SPDX-License-Identifier: Apache-2.0 OR GPL-3.0-or-later

import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk?version=4.0';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk?version=4.0';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const DEFAULT_SHORTCUT = '<Shift><Super>s';
const SHORTCUT_KEY = 'simple-screenshot-open-overlay';

const MODIFIER_KEYS = new Set([
    Gdk.KEY_Shift_L,
    Gdk.KEY_Shift_R,
    Gdk.KEY_Control_L,
    Gdk.KEY_Control_R,
    Gdk.KEY_Alt_L,
    Gdk.KEY_Alt_R,
    Gdk.KEY_Super_L,
    Gdk.KEY_Super_R,
    Gdk.KEY_Meta_L,
    Gdk.KEY_Meta_R,
    Gdk.KEY_Hyper_L,
    Gdk.KEY_Hyper_R,
    Gdk.KEY_ISO_Level3_Shift,
    Gdk.KEY_ISO_Level5_Shift,
]);

function isValidGlobalShortcut(keyval, keycode, modifiers) {
    if (!Gtk.accelerator_valid(keyval, modifiers))
        return false;

    const strongModifiers = Gdk.ModifierType.CONTROL_MASK |
        Gdk.ModifierType.ALT_MASK |
        Gdk.ModifierType.SUPER_MASK |
        Gdk.ModifierType.META_MASK |
        Gdk.ModifierType.HYPER_MASK;
    const worksOnItsOwn = keyval === Gdk.KEY_Print ||
        (keyval >= Gdk.KEY_F1 && keyval <= Gdk.KEY_F35);

    // Global shortcuts without Ctrl, Alt, or Super interfere with normal use.
    return keycode === 0 || worksOnItsOwn || (modifiers & strongModifiers) !== 0;
}

function showShortcutRecorder(window, settings) {
    const dialog = new Adw.Window({
        title: 'Set keyboard shortcut',
        transient_for: window,
        modal: true,
        default_width: 500,
        default_height: 380,
    });

    const root = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL});
    dialog.content = root;
    root.append(new Adw.HeaderBar());

    const content = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 18,
        vexpand: true,
        valign: Gtk.Align.CENTER,
    });
    content.orientation = Gtk.Orientation.VERTICAL;
    content.margin_top = 24;
    content.margin_bottom = 24;
    content.margin_start = 36;
    content.margin_end = 36;
    root.append(content);

    const icon = new Gtk.Image({
        icon_name: 'input-keyboard-symbolic',
        pixel_size: 48,
    });
    icon.add_css_class('accent');
    content.append(icon);

    const heading = new Gtk.Label({
        label: 'Press the new shortcut now',
        justify: Gtk.Justification.CENTER,
    });
    heading.add_css_class('title-2');
    content.append(heading);

    const preview = new Gtk.ShortcutLabel({
        accelerator: '',
        disabled_text: 'Waiting for keys…',
        halign: Gtk.Align.CENTER,
    });
    content.append(preview);

    const hint = new Gtk.Label({
        label: 'Hold one or more modifier keys, then press another key.\nFor example: Shift + Super + S',
        justify: Gtk.Justification.CENTER,
        wrap: true,
    });
    hint.add_css_class('dim-label');
    content.append(hint);

    const saveShortcut = accelerator => {
        settings.set_strv(SHORTCUT_KEY, accelerator ? [accelerator] : []);
        const message = accelerator
            ? `Shortcut set to ${shortcutDisplayName(accelerator)}`
            : 'Keyboard shortcut cleared';
        window.add_toast(new Adw.Toast({title: message, timeout: 3}));
    };

    const actions = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL,
        spacing: 12,
        homogeneous: true,
    });
    const cancel = new Gtk.Button({label: 'Cancel'});
    cancel.connect('clicked', () => dialog.close());
    actions.append(cancel);

    const clear = new Gtk.Button({label: 'Clear'});
    clear.connect('clicked', () => {
        saveShortcut('');
        dialog.close();
    });
    actions.append(clear);

    const useDefault = new Gtk.Button({
        label: 'Use default',
        tooltip_text: 'Shift + Super + S',
        css_classes: ['suggested-action'],
    });
    useDefault.connect('clicked', () => {
        saveShortcut(DEFAULT_SHORTCUT);
        dialog.close();
    });
    actions.append(useDefault);
    content.append(actions);

    const keys = Gtk.EventControllerKey.new();
    keys.propagation_phase = Gtk.PropagationPhase.CAPTURE;
    keys.connect('key-pressed', (_controller, pressedKeyval, keycode, state) => {
        if (pressedKeyval === Gdk.KEY_Escape) {
            dialog.close();
            return Gdk.EVENT_STOP;
        }

        if (MODIFIER_KEYS.has(pressedKeyval)) {
            preview.disabled_text = 'Keep holding, then press another key…';
            return Gdk.EVENT_STOP;
        }

        let keyval = pressedKeyval;
        if (keyval === Gdk.KEY_ISO_Left_Tab)
            keyval = Gdk.KEY_Tab;
        keyval = Gdk.keyval_to_lower(keyval);

        let modifiers = state & Gtk.accelerator_get_default_mod_mask();
        modifiers &= ~Gdk.ModifierType.LOCK_MASK;

        if (!isValidGlobalShortcut(keyval, keycode, modifiers)) {
            preview.accelerator = '';
            preview.disabled_text = 'Add Ctrl, Alt, or Super';
            hint.label = 'That key would interfere with normal typing.\nTry a combination such as Shift + Super + S.';
            return Gdk.EVENT_STOP;
        }

        const accelerator = Gtk.accelerator_name(keyval, modifiers);
        preview.accelerator = accelerator;
        saveShortcut(accelerator);
        dialog.destroy();
        return Gdk.EVENT_STOP;
    });
    dialog.add_controller(keys);
    dialog.present();
}

function shortcutDisplayName(accelerator) {
    if (!accelerator)
        return 'Not set';

    const [success, keyval, modifiers] = Gtk.accelerator_parse(accelerator);
    return success ? Gtk.accelerator_get_label(keyval, modifiers) : 'Not set';
}

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

        const shortcut = new Adw.ActionRow({
            title: 'Keyboard shortcut',
            subtitle: 'Opens the snipping overlay from anywhere',
        });
        const shortcutLabel = new Gtk.ShortcutLabel({
            accelerator: settings.get_strv(SHORTCUT_KEY)[0] ?? '',
            disabled_text: 'Not set',
            valign: Gtk.Align.CENTER,
        });
        const changeShortcut = new Gtk.Button({
            label: 'Change…',
            valign: Gtk.Align.CENTER,
        });
        changeShortcut.connect('clicked', () =>
            showShortcutRecorder(window, settings));
        shortcut.add_suffix(shortcutLabel);
        shortcut.add_suffix(changeShortcut);
        shortcut.activatable_widget = changeShortcut;
        capture.add(shortcut);

        const shortcutChangedId = settings.connect(
            `changed::${SHORTCUT_KEY}`, () => {
                shortcutLabel.accelerator =
                    settings.get_strv(SHORTCUT_KEY)[0] ?? '';
        });
        window.connect('close-request', () => {
            settings.disconnect(shortcutChangedId);
            return false;
        });

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
