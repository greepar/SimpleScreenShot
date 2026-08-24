// SPDX-License-Identifier: Apache-2.0 OR GPL-3.0-or-later

import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk?version=4.0';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';

import {ScreenshotCanvas} from './canvas.js';
import {HistoryStore} from './history.js';
import {t} from './i18n.js';

const TOOLS = [
    ['pen', 'document-edit-symbolic'],
    ['highlighter', 'marker-symbolic'],
    ['arrow', 'go-next-symbolic'],
    ['rectangle', 'selection-mode-symbolic'],
    ['text', 'insert-text-symbolic'],
    ['mosaic', 'view-grid-symbolic'],
    ['crop', 'crop-symbolic'],
];

function colorToHex(color) {
    const channel = value => Math.round(value * 255)
        .toString(16).padStart(2, '0');
    return `#${channel(color.red)}${channel(color.green)}${channel(color.blue)}`;
}

export const EditorWindow = GObject.registerClass(
class EditorWindow extends Adw.ApplicationWindow {
    _init(application, inputPath = null) {
        super._init({
            application,
            title: t('appName'),
            default_width: 1240,
            default_height: 820,
            width_request: 760,
            height_request: 560,
        });

        this._historyStore = new HistoryStore();
        this._modified = false;
        this._buildUi();
        this._loadHistory();

        const initial = inputPath ?? this._historyStore.entries()[0]?.path ?? null;
        if (initial)
            this._loadFile(initial);
        this._syncActions();
    }

    _buildUi() {
        const root = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL});
        this.content = root;

        const header = new Adw.HeaderBar({
            css_classes: ['flat', 'editor-header'],
            show_title: true,
        });
        this._titleLabel = new Gtk.Label({
            label: t('appName'),
            ellipsize: 3,
            css_classes: ['heading'],
        });
        header.title_widget = this._titleLabel;
        root.append(header);

        this._historyToggle = new Gtk.ToggleButton({
            icon_name: 'document-open-recent-symbolic',
            tooltip_text: t('history'),
            active: true,
        });
        header.pack_start(this._historyToggle);

        this._undoButton = this._iconButton('edit-undo-symbolic', t('undo'), () =>
            this._canvas.undo());
        this._redoButton = this._iconButton('edit-redo-symbolic', t('redo'), () =>
            this._canvas.redo());
        header.pack_start(this._undoButton);
        header.pack_start(this._redoButton);

        header.pack_end(this._iconButton('document-save-as-symbolic', t('saveAs'), () =>
            this._saveAs()));
        this._saveButton = this._iconButton('document-save-symbolic', t('save'), () =>
            this._save());
        header.pack_end(this._saveButton);
        this._copyButton = this._iconButton('edit-copy-symbolic', t('copy'), () =>
            this._copy());
        header.pack_end(this._copyButton);

        const workspace = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            hexpand: true,
            vexpand: true,
        });
        root.append(workspace);

        this._historyRevealer = new Gtk.Revealer({
            transition_type: Gtk.RevealerTransitionType.SLIDE_RIGHT,
            reveal_child: true,
        });
        this._historyToggle.bind_property(
            'active', this._historyRevealer, 'reveal-child',
            GObject.BindingFlags.SYNC_CREATE);
        workspace.append(this._historyRevealer);

        const sidebar = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            width_request: 245,
            css_classes: ['history-sidebar'],
        });
        sidebar.append(new Gtk.Label({
            label: t('history'),
            xalign: 0,
            css_classes: ['title-3', 'history-title'],
        }));
        this._historyList = new Gtk.ListBox({
            selection_mode: Gtk.SelectionMode.NONE,
            css_classes: ['boxed-list'],
        });
        this._historyList.connect('row-activated', (_list, row) => {
            if (row.capturePath)
                this._loadFile(row.capturePath);
        });
        const historyScroll = new Gtk.ScrolledWindow({
            hscrollbar_policy: Gtk.PolicyType.NEVER,
            vexpand: true,
            child: this._historyList,
        });
        sidebar.append(historyScroll);
        this._historyRevealer.child = sidebar;

        this._canvas = new ScreenshotCanvas({
            requestText: (x, y, callback) => this._showTextDialog(x, y, callback),
        });
        this._canvas.connect('changed', () => {
            this._modified = true;
            this._syncActions();
        });
        this._canvas.connect('history-changed', () => this._syncActions());
        this._canvas.connect('pending-crop-changed', () => this._syncCropActions());
        this._canvas.connect('file-changed', () => {
            this._modified = false;
            this._syncActions();
        });
        const canvasScroll = new Gtk.ScrolledWindow({
            hexpand: true,
            vexpand: true,
            child: this._canvas,
            css_classes: ['canvas-scroll'],
        });
        workspace.append(canvasScroll);

        const controls = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 6,
            halign: Gtk.Align.CENTER,
            css_classes: ['editor-toolbar'],
        });
        root.append(controls);

        let firstTool = null;
        this._toolButtons = new Map();
        for (const [tool, icon] of TOOLS) {
            const button = new Gtk.ToggleButton({
                icon_name: icon,
                tooltip_text: t(tool),
                css_classes: ['flat', 'tool-button'],
            });
            if (firstTool)
                button.set_group(firstTool);
            else
                firstTool = button;
            button.connect('toggled', () => {
                if (button.active)
                    this._canvas.setTool(tool);
            });
            controls.append(button);
            this._toolButtons.set(tool, button);
        }
        firstTool.active = true;

        controls.append(new Gtk.Separator({orientation: Gtk.Orientation.VERTICAL}));

        const colorDialog = new Gtk.ColorDialog({title: t('color')});
        const initialColor = new Gdk.RGBA();
        initialColor.parse('#ff3b30');
        const color = new Gtk.ColorDialogButton({
            dialog: colorDialog,
            rgba: initialColor,
            tooltip_text: t('color'),
        });
        color.connect('notify::rgba', () =>
            this._canvas.setColor(colorToHex(color.rgba)));
        controls.append(color);

        this._width = Gtk.DropDown.new_from_strings(['2 px', '4 px', '8 px', '14 px']);
        this._width.selected = 1;
        this._width.tooltip_text = t('strokeWidth');
        this._width.connect('notify::selected', () =>
            this._canvas.setStrokeWidth([2, 4, 8, 14][this._width.selected]));
        controls.append(this._width);

        controls.append(new Gtk.Separator({orientation: Gtk.Orientation.VERTICAL}));
        this._cropApply = new Gtk.Button({label: t('apply'), css_classes: ['suggested-action']});
        this._cropApply.connect('clicked', () => this._canvas.applyPendingCrop());
        controls.append(this._cropApply);
        this._cropCancel = new Gtk.Button({label: t('cancel')});
        this._cropCancel.connect('clicked', () => this._canvas.cancelPendingCrop());
        controls.append(this._cropCancel);

        controls.append(new Gtk.Separator({orientation: Gtk.Orientation.VERTICAL}));
        controls.append(this._iconButton('zoom-out-symbolic', t('zoomOut'), () =>
            this._canvas.zoomBy(0.82)));
        controls.append(this._iconButton('zoom-fit-best-symbolic', t('fit'), () =>
            this._canvas.fitToWindow()));
        controls.append(this._iconButton('zoom-in-symbolic', t('zoomIn'), () =>
            this._canvas.zoomBy(1.22)));

        this._status = new Gtk.Label({
            label: t('untitled'),
            xalign: 0,
            css_classes: ['dim-label', 'editor-status'],
        });
        root.append(this._status);

        const keys = Gtk.EventControllerKey.new();
        keys.connect('key-pressed', (_controller, keyval, _keycode, state) => {
            const control = Boolean(state & Gdk.ModifierType.CONTROL_MASK);
            if (control && keyval === Gdk.KEY_z) {
                this._canvas.undo();
                return Gdk.EVENT_STOP;
            }
            if (control && (keyval === Gdk.KEY_y ||
                (keyval === Gdk.KEY_Z && state & Gdk.ModifierType.SHIFT_MASK))) {
                this._canvas.redo();
                return Gdk.EVENT_STOP;
            }
            if (control && keyval === Gdk.KEY_s) {
                this._save();
                return Gdk.EVENT_STOP;
            }
            if (control && keyval === Gdk.KEY_c) {
                this._copy();
                return Gdk.EVENT_STOP;
            }
            if (keyval === Gdk.KEY_Escape && this._canvas.pendingCrop) {
                this._canvas.cancelPendingCrop();
                return Gdk.EVENT_STOP;
            }
            if (keyval === Gdk.KEY_Return && this._canvas.pendingCrop) {
                this._canvas.applyPendingCrop();
                return Gdk.EVENT_STOP;
            }
            return Gdk.EVENT_PROPAGATE;
        });
        this.add_controller(keys);
        this._syncCropActions();
    }

    _iconButton(iconName, tooltip, callback) {
        const button = new Gtk.Button({
            icon_name: iconName,
            tooltip_text: tooltip,
            css_classes: ['flat'],
        });
        button.connect('clicked', callback);
        return button;
    }

    _loadHistory() {
        let child = this._historyList.get_first_child();
        while (child) {
            const next = child.get_next_sibling();
            this._historyList.remove(child);
            child = next;
        }

        const entries = this._historyStore.entries();
        if (entries.length === 0) {
            this._historyList.append(new Gtk.Label({
                label: t('emptyHistory'),
                wrap: true,
                margin_top: 24,
                margin_bottom: 24,
                margin_start: 16,
                margin_end: 16,
                css_classes: ['dim-label'],
            }));
            return;
        }

        for (const entry of entries) {
            const row = new Gtk.ListBoxRow({
                activatable: true,
                css_classes: ['history-row'],
            });
            row.capturePath = entry.path;
            const box = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 5,
                margin_top: 8,
                margin_bottom: 8,
                margin_start: 8,
                margin_end: 8,
            });
            const picture = Gtk.Picture.new_for_filename(entry.path);
            picture.set_size_request(205, 112);
            picture.content_fit = Gtk.ContentFit.COVER;
            picture.can_shrink = true;
            box.append(picture);
            box.append(new Gtk.Label({
                label: GLib.path_get_basename(entry.path),
                ellipsize: 3,
                xalign: 0,
                css_classes: ['caption'],
            }));
            row.child = box;
            this._historyList.append(row);
        }
    }

    _loadFile(path) {
        try {
            this._canvas.loadFile(path);
        } catch (error) {
            this._showError(t('openFailed'), error.message);
        }
    }

    _showTextDialog(_x, _y, callback) {
        const dialog = new Gtk.Dialog({
            title: t('addText'),
            transient_for: this,
            modal: true,
            use_header_bar: true,
        });
        dialog.add_button(t('cancel'), Gtk.ResponseType.CANCEL);
        dialog.add_button(t('apply'), Gtk.ResponseType.OK);
        const entry = new Gtk.Entry({
            placeholder_text: t('textPlaceholder'),
            activates_default: true,
            margin_top: 18,
            margin_bottom: 18,
            margin_start: 18,
            margin_end: 18,
        });
        dialog.get_content_area().append(entry);
        dialog.set_default_response(Gtk.ResponseType.OK);
        dialog.connect('response', (_dialog, response) => {
            if (response === Gtk.ResponseType.OK)
                callback(entry.text);
            dialog.destroy();
        });
        dialog.present();
        entry.grab_focus();
    }

    _save() {
        if (!this._canvas.filePath)
            return this._saveAs();
        try {
            this._canvas.exportPng(this._canvas.filePath);
            this._modified = false;
            this._status.label = `${t('saved')}: ${this._canvas.filePath}`;
            this._syncActions();
            this._loadHistory();
        } catch (error) {
            this._showError(t('saveFailed'), error.message);
        }
    }

    _saveAs() {
        if (!this._canvas.hasImage)
            return;
        const dialog = new Gtk.FileDialog({
            title: t('saveAs'),
            initial_name: this._canvas.filePath
                ? GLib.path_get_basename(this._canvas.filePath)
                : 'Screenshot.png',
        });
        const filter = new Gtk.FileFilter();
        filter.name = 'PNG image';
        filter.add_mime_type('image/png');
        dialog.default_filter = filter;
        dialog.save(this, null, (_dialog, result) => {
            try {
                const file = dialog.save_finish(result);
                let path = file.get_path();
                if (!path.toLowerCase().endsWith('.png'))
                    path += '.png';
                this._canvas.exportPng(path);
                this._canvas.markSaved(path);
                this._status.label = `${t('saved')}: ${path}`;
            } catch (error) {
                if (!error.matches(Gtk.DialogError, Gtk.DialogError.DISMISSED))
                    this._showError(t('saveFailed'), error.message);
            }
        });
    }

    _copy() {
        if (!this._canvas.hasImage)
            return;
        const tempPath = GLib.build_filenamev([
            GLib.get_user_runtime_dir(), `simple-screenshot-copy-${GLib.get_monotonic_time()}.png`,
        ]);
        try {
            this._canvas.exportPng(tempPath);
            const texture = Gdk.Texture.new_from_filename(tempPath);
            Gdk.Display.get_default().get_clipboard().set(texture);
            this._status.label = t('copied');
        } catch (error) {
            this._showError(t('saveFailed'), error.message);
        }
    }

    _syncActions() {
        const loaded = this._canvas?.hasImage ?? false;
        this._undoButton.sensitive = loaded && this._canvas.canUndo;
        this._redoButton.sensitive = loaded && this._canvas.canRedo;
        this._saveButton.sensitive = loaded;
        this._copyButton.sensitive = loaded;
        if (loaded) {
            const {width, height} = this._canvas.imageSize;
            this.title = `${GLib.path_get_basename(this._canvas.filePath)}${this._modified ? ' •' : ''}`;
            this._titleLabel.label = this.title;
            this._status.label = `${Math.round(width)} × ${Math.round(height)} px`;
        } else {
            this.title = t('appName');
            this._titleLabel.label = this.title;
            this._status.label = t('untitled');
        }
    }

    _syncCropActions() {
        const visible = Boolean(this._canvas.pendingCrop);
        this._cropApply.visible = visible;
        this._cropCancel.visible = visible;
    }

    _showError(heading, detail) {
        const dialog = new Adw.MessageDialog({
            transient_for: this,
            heading,
            body: detail,
        });
        dialog.add_response('close', t('cancel'));
        dialog.present();
    }
});
