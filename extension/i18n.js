// SPDX-License-Identifier: Apache-2.0 OR GPL-3.0-or-later

import GLib from 'gi://GLib';

const japanese = GLib.get_language_names().some(name => name.startsWith('ja'));

const strings = {
    region: ['Rectangular snip', '四角形の領域切り取り'],
    window: ['Window snip', 'ウィンドウの切り取り'],
    screen: ['Full-screen snip', '全画面の切り取り'],
    regionHint: ['Drag to select an area', 'ドラッグして領域を選択'],
    windowHint: ['Click a window to capture it', '撮影するウィンドウをクリック'],
    screenHint: ['Click a display to capture it', '撮影する画面をクリック'],
    cancel: ['Close', '閉じる'],
    settings: ['Settings', '設定'],
    copied: ['Copied to clipboard', 'クリップボードにコピーしました'],
    captured: ['Screenshot captured', 'スクリーンショットを撮影しました'],
    notificationBody: ['Click the preview to mark it up.', 'プレビューをクリックすると編集できます。'],
    edit: ['Edit', '編集'],
    showFiles: ['Show in Files', 'ファイルで表示'],
    area: ['Capture area', '領域を撮影'],
    captureWindow: ['Capture window', 'ウィンドウを撮影'],
    captureScreen: ['Capture screen', '画面を撮影'],
    openEditor: ['Open editor', 'エディタを開く'],
    history: ['Recent captures', '最近の撮影'],
    openFailed: ['Could not open the screenshot editor', 'スクリーンショットエディタを開けませんでした'],
};

export function t(key) {
    const value = strings[key] ?? [key, key];
    return value[japanese ? 1 : 0];
}
