// SPDX-License-Identifier: Apache-2.0 OR GPL-3.0-or-later

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

export class HistoryStore {
    constructor() {
        this.path = GLib.build_filenamev([
            GLib.get_user_data_dir(), 'simple-screenshot', 'history.json',
        ]);
    }

    entries() {
        try {
            const [ok, contents] = GLib.file_get_contents(this.path);
            if (!ok)
                return [];
            const entries = JSON.parse(new TextDecoder().decode(contents));
            return entries.filter(entry =>
                typeof entry.path === 'string' &&
                Gio.File.new_for_path(entry.path).query_exists(null));
        } catch (_error) {
            return [];
        }
    }
}
