// SPDX-License-Identifier: Apache-2.0 OR GPL-3.0-or-later

import GLib from 'gi://GLib';

const japanese = GLib.get_language_names().some(name => name.startsWith('ja'));

const strings = {
    appName: ['Simple ScreenShot', 'Simple ScreenShot'],
    untitled: ['No screenshot selected', 'スクリーンショットが選択されていません'],
    history: ['History', '履歴'],
    undo: ['Undo', '元に戻す'],
    redo: ['Redo', 'やり直す'],
    copy: ['Copy', 'コピー'],
    save: ['Save', '保存'],
    saveAs: ['Save as', '名前を付けて保存'],
    pen: ['Pen', 'ペン'],
    highlighter: ['Highlighter', '蛍光ペン'],
    arrow: ['Arrow', '矢印'],
    rectangle: ['Rectangle', '四角形'],
    text: ['Text', '文字'],
    mosaic: ['Mosaic', 'モザイク'],
    crop: ['Crop', '切り抜き'],
    apply: ['Apply', '適用'],
    cancel: ['Cancel', 'キャンセル'],
    addText: ['Add text', '文字を追加'],
    textPlaceholder: ['Type something…', '文字を入力…'],
    copied: ['Image copied to clipboard', '画像をクリップボードにコピーしました'],
    saved: ['Saved', '保存しました'],
    openFailed: ['The image could not be opened.', '画像を開けませんでした。'],
    saveFailed: ['The image could not be saved.', '画像を保存できませんでした。'],
    emptyHistory: ['Your recent captures appear here.', '最近撮影した画像がここに表示されます。'],
    strokeWidth: ['Stroke width', '線の太さ'],
    color: ['Color', '色'],
    zoomIn: ['Zoom in', '拡大'],
    zoomOut: ['Zoom out', '縮小'],
    fit: ['Fit to window', 'ウィンドウに合わせる'],
};

export function t(key) {
    const value = strings[key] ?? [key, key];
    return value[japanese ? 1 : 0];
}
