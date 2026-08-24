// SPDX-License-Identifier: Apache-2.0 OR GPL-3.0-or-later

import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk?version=4.0';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';

import {EditorWindow} from './window.js';

export const EditorApplication = GObject.registerClass(
class EditorApplication extends Adw.Application {
    _init(inputPath = null, extensionPath = null) {
        super._init({
            application_id: 'io.github.simple_screenshot.Editor',
            flags: Gio.ApplicationFlags.NON_UNIQUE,
        });
        this._inputPath = inputPath;
        this._extensionPath = extensionPath;
    }

    vfunc_startup() {
        super.vfunc_startup();
        if (!this._extensionPath)
            return;
        const provider = new Gtk.CssProvider();
        provider.load_from_path(`${this._extensionPath}/editor/style.css`);
        Gtk.StyleContext.add_provider_for_display(
            this.get_active_window()?.get_display() ?? Gdk.Display.get_default(),
            provider,
            Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);
    }

    vfunc_activate() {
        const window = new EditorWindow(this, this._inputPath);
        window.present();
    }
});
