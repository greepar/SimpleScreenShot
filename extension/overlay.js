// SPDX-License-Identifier: Apache-2.0 OR GPL-3.0-or-later

import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {normalizeRect, rectForPoint} from './geometry.js';
import {t} from './i18n.js';

const MODES = ['region', 'window', 'screen'];

function modeIcon(mode) {
    return {
        region: 'selection-mode-symbolic',
        window: 'focus-windows-symbolic',
        screen: 'view-fullscreen-symbolic',
    }[mode];
}

function modeLabel(mode) {
    return t(mode);
}

export const SnippingOverlay = GObject.registerClass(
class SnippingOverlay extends St.Widget {
    _init(params = {}) {
        super._init({
            name: 'simple-screenshot-overlay',
            reactive: true,
            can_focus: true,
            track_hover: true,
            layout_manager: new Clutter.BinLayout(),
        });

        this._onCapture = params.onCapture;
        this._onCancel = params.onCancel;
        this._onSettings = params.onSettings;
        this._mode = MODES.includes(params.initialMode)
            ? params.initialMode
            : 'region';
        this._dragging = false;
        this._start = null;
        this._currentRect = null;
        this._grab = null;

        this._background = new St.Widget({x_expand: true, y_expand: true});
        this.add_child(this._background);

        this._fullShade = new St.Widget({
            style_class: 'simple-screenshot-shade',
            x_expand: true,
            y_expand: true,
        });
        this.add_child(this._fullShade);

        this._shades = Array.from({length: 4}, () => {
            const shade = new St.Widget({
                style_class: 'simple-screenshot-shade',
                visible: false,
            });
            this.add_child(shade);
            return shade;
        });

        this._selection = new St.Widget({
            style_class: 'simple-screenshot-selection',
            visible: false,
        });
        this.add_child(this._selection);

        this._sizeLabel = new St.Label({
            style_class: 'simple-screenshot-size-label',
            visible: false,
        });
        this.add_child(this._sizeLabel);

        this._toolbar = this._buildToolbar();
        this._toolbarHost = new St.BoxLayout({
            vertical: true,
            x_expand: true,
            y_expand: true,
            y_align: Clutter.ActorAlign.START,
        });
        this._toolbarHost.add_child(this._toolbar);
        this.add_child(this._toolbarHost);

        this._hint = new St.Label({
            style_class: 'simple-screenshot-hint',
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.END,
            y_expand: true,
        });
        this.add_child(this._hint);

        this.connect('button-press-event', this._onButtonPress.bind(this));
        this.connect('motion-event', this._onMotion.bind(this));
        this.connect('button-release-event', this._onButtonRelease.bind(this));
        this.connect('key-press-event', this._onKeyPress.bind(this));
        this.connect('destroy', () => this._releaseModal());
        this._syncMode();
    }

    _buildToolbar() {
        const box = new St.BoxLayout({
            style_class: 'simple-screenshot-toolbar',
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.START,
        });
        this._modeButtons = new Map();

        for (const mode of MODES) {
            const child = new St.BoxLayout({
                style_class: 'simple-screenshot-tool-content',
                vertical: true,
            });
            child.add_child(new St.Icon({
                icon_name: modeIcon(mode),
                style_class: 'simple-screenshot-tool-icon',
            }));
            child.add_child(new St.Label({
                text: modeLabel(mode),
                style_class: 'simple-screenshot-tool-label',
            }));

            const button = new St.Button({
                style_class: 'simple-screenshot-tool-button',
                child,
                can_focus: true,
            });
            button.connect('clicked', () => this.setMode(mode));
            box.add_child(button);
            this._modeButtons.set(mode, button);
        }

        box.add_child(new St.Widget({style_class: 'simple-screenshot-divider'}));
        box.add_child(this._iconButton(
            'preferences-system-symbolic', t('settings'), () => {
                const callback = this._onSettings;
                this._close();
                callback?.();
            }));
        box.add_child(this._iconButton(
            'window-close-symbolic', t('cancel'), () => this.cancel()));
        return box;
    }

    _iconButton(iconName, accessibleName, callback) {
        const button = new St.Button({
            style_class: 'simple-screenshot-icon-button',
            child: new St.Icon({
                icon_name: iconName,
                style_class: 'simple-screenshot-action-icon',
            }),
            can_focus: true,
            accessible_name: accessibleName,
        });
        button.connect('clicked', callback);
        return button;
    }

    open(snapshot) {
        this._snapshot = snapshot;
        this._background.set_content(snapshot.content);
        Main.layoutManager.addTopChrome(this, {trackFullscreen: true});
        this.set_position(0, 0);
        this.set_size(global.stage.width, global.stage.height);
        this._grab = Main.pushModal(this, {actionMode: Shell.ActionMode.NORMAL});
        this.grab_key_focus();
        this.opacity = 0;
        this.ease({opacity: 255, duration: 120, mode: Clutter.AnimationMode.EASE_OUT_QUAD});
        this._syncHoverRect(...global.get_pointer());
    }

    setMode(mode) {
        if (!MODES.includes(mode))
            return;
        this._mode = mode;
        this._dragging = false;
        this._currentRect = null;
        this._selection.hide();
        this._sizeLabel.hide();
        this._fullShade.show();
        this._shades.forEach(shade => shade.hide());
        this._syncMode();
        this._syncHoverRect(...global.get_pointer());
        this.grab_key_focus();
    }

    _syncMode() {
        for (const [mode, button] of this._modeButtons) {
            if (mode === this._mode)
                button.add_style_pseudo_class('checked');
            else
                button.remove_style_pseudo_class('checked');
        }

        this._hint.text = {
            region: t('regionHint'),
            window: t('windowHint'),
            screen: t('screenHint'),
        }[this._mode];
    }

    _onButtonPress(_actor, event) {
        if (event.get_button() !== Clutter.BUTTON_PRIMARY)
            return Clutter.EVENT_PROPAGATE;

        const source = event.get_source();
        if (source && (source === this._toolbar || this._toolbar.contains(source)))
            return Clutter.EVENT_PROPAGATE;

        const [x, y] = event.get_coords();
        if (this._mode === 'region') {
            this._dragging = true;
            this._start = {x, y};
            this._showRect({x, y, width: 1, height: 1}, true);
        } else if (this._currentRect) {
            this._requestCapture(this._currentRect);
        }
        return Clutter.EVENT_STOP;
    }

    _onMotion(_actor, event) {
        const [x, y] = event.get_coords();
        if (this._mode === 'region' && this._dragging) {
            const rect = normalizeRect(
                this._start.x, this._start.y, x, y,
                {x: 0, y: 0, width: this.width, height: this.height});
            this._showRect(rect, true);
        } else if (this._mode !== 'region') {
            this._syncHoverRect(x, y);
        }
        return Clutter.EVENT_STOP;
    }

    _onButtonRelease(_actor, event) {
        if (event.get_button() !== Clutter.BUTTON_PRIMARY || !this._dragging)
            return Clutter.EVENT_PROPAGATE;

        this._dragging = false;
        const [x, y] = event.get_coords();
        const rect = normalizeRect(
            this._start.x, this._start.y, x, y,
            {x: 0, y: 0, width: this.width, height: this.height});
        if (rect.width >= 4 && rect.height >= 4)
            this._requestCapture(rect);
        else
            this._resetSelection();
        return Clutter.EVENT_STOP;
    }

    _onKeyPress(_actor, event) {
        const symbol = event.get_key_symbol();
        if (symbol === Clutter.KEY_Escape) {
            this.cancel();
            return Clutter.EVENT_STOP;
        }
        if (symbol === Clutter.KEY_r || symbol === Clutter.KEY_R)
            this.setMode('region');
        else if (symbol === Clutter.KEY_w || symbol === Clutter.KEY_W)
            this.setMode('window');
        else if (symbol === Clutter.KEY_f || symbol === Clutter.KEY_F)
            this.setMode('screen');
        else
            return Clutter.EVENT_PROPAGATE;
        return Clutter.EVENT_STOP;
    }

    _syncHoverRect(x, y) {
        if (this._mode === 'window') {
            const windows = global.get_window_actors()
                .filter(actor => actor.visible)
                .map(actor => actor.meta_window)
                .filter(window => window &&
                    window.showing_on_its_workspace() &&
                    !window.is_override_redirect() &&
                    window.get_window_type() !== Meta.WindowType.DESKTOP)
                .map(window => {
                    const frame = window.get_frame_rect();
                    return {x: frame.x, y: frame.y, width: frame.width, height: frame.height};
                });
            this._currentRect = rectForPoint(windows.reverse(), x, y);
        } else if (this._mode === 'screen') {
            this._currentRect = rectForPoint(Main.layoutManager.monitors, x, y);
        }

        if (this._currentRect)
            this._showRect(this._currentRect, false);
        else
            this._resetSelection();
    }

    _showRect(rect, showSize) {
        this._currentRect = rect;
        this._fullShade.hide();
        this._shades.forEach(shade => shade.show());
        this._selection.show();
        this._selection.set_position(rect.x, rect.y);
        this._selection.set_size(rect.width, rect.height);

        const [top, bottom, left, right] = this._shades;
        top.set_position(0, 0);
        top.set_size(this.width, rect.y);
        bottom.set_position(0, rect.y + rect.height);
        bottom.set_size(this.width, Math.max(0, this.height - rect.y - rect.height));
        left.set_position(0, rect.y);
        left.set_size(rect.x, rect.height);
        right.set_position(rect.x + rect.width, rect.y);
        right.set_size(Math.max(0, this.width - rect.x - rect.width), rect.height);

        if (showSize && rect.width > 20 && rect.height > 20) {
            this._sizeLabel.text = `${rect.width} × ${rect.height}`;
            this._sizeLabel.show();
            const labelWidth = Math.max(92, this._sizeLabel.width);
            const labelX = Math.min(
                Math.max(8, rect.x), Math.max(8, this.width - labelWidth - 8));
            const labelY = rect.y + rect.height + 10 < this.height - 42
                ? rect.y + rect.height + 8
                : Math.max(8, rect.y - 38);
            this._sizeLabel.set_position(labelX, labelY);
        } else {
            this._sizeLabel.hide();
        }
    }

    _resetSelection() {
        this._currentRect = null;
        this._selection.hide();
        this._sizeLabel.hide();
        this._fullShade.show();
        this._shades.forEach(shade => shade.hide());
    }

    _requestCapture(rect) {
        const snapshot = this._snapshot;
        this._close();
        this._onCapture?.(snapshot, rect);
    }

    cancel() {
        this._close();
        this._onCancel?.();
    }

    _close() {
        this._releaseModal();
        this.destroy();
    }

    _releaseModal() {
        if (!this._grab)
            return;
        Main.popModal(this._grab);
        this._grab = null;
    }
});
