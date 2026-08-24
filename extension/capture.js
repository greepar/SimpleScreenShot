// SPDX-License-Identifier: Apache-2.0 OR GPL-3.0-or-later

import Cogl from 'gi://Cogl';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GdkPixbuf from 'gi://GdkPixbuf';
import Shell from 'gi://Shell';
import St from 'gi://St';

import {sanitizeFilename} from './geometry.js';

Gio._promisify(Shell.Screenshot.prototype, 'screenshot_stage_to_content');
Gio._promisify(Shell.Screenshot, 'composite_to_stream');

function ensureDirectory(path) {
    const directory = Gio.File.new_for_path(path);
    try {
        directory.make_directory_with_parents(null);
    } catch (error) {
        if (!error.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.EXISTS))
            throw error;
    }
    return directory;
}

function defaultPicturesDirectory() {
    const pictures = GLib.get_user_special_dir(
        GLib.UserDirectory.DIRECTORY_PICTURES) ?? GLib.get_home_dir();
    return GLib.build_filenamev([pictures, 'Screenshots']);
}

function expandUserDirectory(path) {
    if (path === '~')
        return GLib.get_home_dir();
    if (path.startsWith('~/'))
        return GLib.build_filenamev([GLib.get_home_dir(), path.slice(2)]);
    return path;
}

function createUniqueFile(directory, basename) {
    for (let suffix = 0; ; suffix++) {
        const tail = suffix === 0 ? '' : `-${suffix + 1}`;
        const file = directory.get_child(`${basename}${tail}.png`);
        if (!file.query_exists(null))
            return file;
    }
}

function writeBytes(file, bytes) {
    const stream = file.create(Gio.FileCreateFlags.NONE, null);
    try {
        stream.write_bytes(bytes, null);
    } finally {
        stream.close(null);
    }
}

function writeJson(filePath, value) {
    const file = Gio.File.new_for_path(filePath);
    const bytes = new TextEncoder().encode(JSON.stringify(value, null, 2));
    file.replace_contents(
        bytes, null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null);
}

function readJson(filePath, fallback) {
    try {
        const [ok, contents] = GLib.file_get_contents(filePath);
        if (!ok)
            return fallback;
        return JSON.parse(new TextDecoder().decode(contents));
    } catch (_error) {
        return fallback;
    }
}

export class CaptureService {
    constructor(settings) {
        this._settings = settings;
        this._historyPath = GLib.build_filenamev([
            GLib.get_user_data_dir(), 'simple-screenshot', 'history.json',
        ]);
    }

    async prepare() {
        const shooter = new Shell.Screenshot();
        const [content, scale, cursorContent, cursorPoint, cursorScale] =
            await shooter.screenshot_stage_to_content();

        return {
            content,
            texture: content.get_texture(),
            scale,
            cursorContent,
            cursorPoint,
            cursorScale,
        };
    }

    async capture(snapshot, geometry) {
        const scale = snapshot.scale;
        const stream = Gio.MemoryOutputStream.new_resizable();
        const includePointer = this._settings.get_boolean('include-pointer');
        const cursorTexture = includePointer
            ? snapshot.cursorContent?.get_texture() ?? null
            : null;
        const scaled = [
            geometry.x * scale,
            geometry.y * scale,
            geometry.width * scale,
            geometry.height * scale,
        ].map(value => Math.round(value));

        const pixbuf = await Shell.Screenshot.composite_to_stream(
            snapshot.texture,
            ...scaled,
            scale,
            cursorTexture,
            (snapshot.cursorPoint?.x ?? 0) * scale,
            (snapshot.cursorPoint?.y ?? 0) * scale,
            snapshot.cursorScale ?? 1,
            stream
        );
        stream.close(null);
        const bytes = stream.steal_as_bytes();

        global.display.get_sound_player().play_from_theme(
            'screen-capture', 'Screenshot taken', null);

        if (this._settings.get_boolean('copy-to-clipboard')) {
            St.Clipboard.get_default().set_content(
                St.ClipboardType.CLIPBOARD, 'image/png', bytes);
        }

        const file = this._writeCapture(bytes);
        this._appendHistory(file, geometry);

        return {file, pixbuf, bytes};
    }

    _writeCapture(bytes) {
        const keepCopy = this._settings.get_boolean('save-copies');
        let directoryPath;

        if (keepCopy) {
            const configured = this._settings.get_string('save-directory').trim();
            directoryPath = configured
                ? expandUserDirectory(configured)
                : defaultPicturesDirectory();
        } else {
            directoryPath = GLib.build_filenamev([
                GLib.get_user_runtime_dir(), 'simple-screenshot',
            ]);
        }

        const directory = ensureDirectory(directoryPath);
        const now = GLib.DateTime.new_now_local();
        const replacements = {
            '{date}': now.format('%Y-%m-%d'),
            '{time}': now.format('%H-%M-%S'),
            '{timestamp}': now.format('%Y-%m-%d %H-%M-%S'),
        };
        let basename = this._settings.get_string('filename-pattern');
        for (const [token, value] of Object.entries(replacements))
            basename = basename.replaceAll(token, value);

        const file = createUniqueFile(directory, sanitizeFilename(basename));
        writeBytes(file, bytes);
        return file;
    }

    _appendHistory(file, geometry) {
        ensureDirectory(GLib.path_get_dirname(this._historyPath));
        const history = readJson(this._historyPath, []);
        history.unshift({
            path: file.get_path(),
            uri: file.get_uri(),
            createdAt: GLib.DateTime.new_now_local().format_iso8601(),
            width: geometry.width,
            height: geometry.height,
        });

        const limit = this._settings.get_int('history-limit');
        writeJson(this._historyPath, history.slice(0, limit));
    }

    static previewContent(pixbuf) {
        const pixels = pixbuf.read_pixel_bytes();
        const content = St.ImageContent.new_with_preferred_size(
            pixbuf.width, pixbuf.height);
        const hasAlpha = pixbuf.get_has_alpha();
        content.set_bytes(
            pixels,
            hasAlpha ? Cogl.PixelFormat.RGBA_8888 : Cogl.PixelFormat.RGB_888,
            pixbuf.width,
            pixbuf.height,
            pixbuf.rowstride
        );
        return content;
    }
}
