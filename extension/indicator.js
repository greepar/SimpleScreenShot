// SPDX-License-Identifier: Apache-2.0 OR GPL-3.0-or-later

import GObject from 'gi://GObject';
import St from 'gi://St';

import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import {t} from './i18n.js';

export const CaptureIndicator = GObject.registerClass(
class CaptureIndicator extends PanelMenu.Button {
    _init(extension) {
        super._init(0.0, 'Simple ScreenShot');
        this._extension = extension;
        this.add_child(new St.Icon({
            icon_name: 'camera-photo-symbolic',
            style_class: 'system-status-icon',
        }));

        this.menu.addAction(t('area'), () => extension.openOverlay('region'));
        this.menu.addAction(t('captureWindow'), () => extension.openOverlay('window'));
        this.menu.addAction(t('captureScreen'), () => extension.openOverlay('screen'));
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addAction(t('history'), () => extension.openEditor());
        this.menu.addAction(t('settings'), () => extension.openPreferences());
    }
});
