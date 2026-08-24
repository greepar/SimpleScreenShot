// SPDX-License-Identifier: Apache-2.0 OR GPL-3.0-or-later

import Gio from 'gi://Gio';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as MessageTray from 'resource:///org/gnome/shell/ui/messageTray.js';

import {CaptureService} from './capture.js';
import {CaptureIndicator} from './indicator.js';
import {SnippingOverlay} from './overlay.js';
import {t} from './i18n.js';

const SHORTCUT_KEY = 'shortcut';

export default class SimpleScreenshotExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._captureService = new CaptureService(this._settings);
        this._overlay = null;
        this._openingOverlay = false;
        this._indicator = null;

        Main.wm.addKeybinding(
            SHORTCUT_KEY,
            this._settings,
            Meta.KeyBindingFlags.IGNORE_AUTOREPEAT,
            Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW,
            () => this.openOverlay()
        );

        this._indicatorSignal = this._settings.connect(
            'changed::show-indicator', () => this._syncIndicator());
        this._syncIndicator();
    }

    disable() {
        Main.wm.removeKeybinding(SHORTCUT_KEY);
        this._overlay?.cancel();
        this._overlay = null;
        this._openingOverlay = false;
        this._indicator?.destroy();
        this._indicator = null;
        if (this._indicatorSignal)
            this._settings.disconnect(this._indicatorSignal);
        this._indicatorSignal = 0;
        this._captureService = null;
        this._settings = null;
    }

    async openOverlay(mode = null) {
        if (this._overlay || this._openingOverlay)
            return;

        this._openingOverlay = true;
        try {
            const snapshot = await this._captureService.prepare();
            if (!this._settings)
                return;

            this._overlay = new SnippingOverlay({
                initialMode: mode ?? this._settings.get_string('default-mode'),
                onCapture: (prepared, rect) => this._capture(prepared, rect),
                onCancel: () => {
                    this._overlay = null;
                },
                onSettings: () => this.openPreferences(),
            });
            this._overlay.connect('destroy', () => {
                this._overlay = null;
            });
            this._overlay.open(snapshot);
        } catch (error) {
            console.error(`Unable to open Simple ScreenShot: ${error.message}`);
            Main.notifyError('Simple ScreenShot', error.message);
            this._overlay = null;
        } finally {
            this._openingOverlay = false;
        }
    }

    async _capture(snapshot, rect) {
        this._overlay = null;
        try {
            const result = await this._captureService.capture(snapshot, rect);
            if (!this._settings)
                return;

            if (this._settings.get_boolean('auto-open-editor'))
                this.openEditor(result.file.get_path());
            if (this._settings.get_boolean('show-notification'))
                this._showNotification(result);
        } catch (error) {
            console.error(`Unable to save screenshot: ${error.message}`);
            Main.notifyError('Simple ScreenShot', error.message);
        }
    }

    _showNotification(result) {
        const source = new MessageTray.Source({
            title: 'Simple ScreenShot',
            iconName: 'camera-photo-symbolic',
        });
        const notification = new MessageTray.Notification({
            source,
            title: t('captured'),
            body: t('notificationBody'),
            gicon: CaptureService.previewContent(result.pixbuf),
            isTransient: true,
        });

        notification.connect('activated', () =>
            this.openEditor(result.file.get_path()));
        notification.addAction(t('edit'), () =>
            this.openEditor(result.file.get_path()));
        notification.addAction(t('showFiles'), () => {
            const manager = Gio.app_info_get_default_for_type('inode/directory', false);
            manager?.launch([result.file.get_parent()],
                global.create_app_launch_context(0, -1));
        });

        Main.messageTray.add(source);
        source.addNotification(notification);
    }

    openEditor(filePath = null) {
        const editor = `${this.path}/editor/main.js`;
        const argv = ['gjs', '-m', editor];
        if (filePath)
            argv.push(filePath);

        try {
            Gio.Subprocess.new(argv, Gio.SubprocessFlags.NONE);
        } catch (error) {
            console.error(`${t('openFailed')}: ${error.message}`);
            Main.notifyError('Simple ScreenShot', t('openFailed'));
        }
    }

    _syncIndicator() {
        const shouldShow = this._settings.get_boolean('show-indicator');
        if (shouldShow && !this._indicator) {
            this._indicator = new CaptureIndicator(this);
            Main.panel.addToStatusArea(this.uuid, this._indicator);
        } else if (!shouldShow && this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }
    }
}
