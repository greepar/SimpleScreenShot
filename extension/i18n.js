// SPDX-License-Identifier: Apache-2.0 OR GPL-3.0-or-later

import GLib from 'gi://GLib';

const japanese = GLib.get_language_names().some(name => name.startsWith('ja'));

const chinese = true;
const zh = {
    "region": "手动选区",
    "window": "智能框选",
    "screen": "整个屏幕",
    "regionHint": "拖动选择区域 · W 智能框选 · Esc / 右键取消",
    "windowHint": "移动鼠标自动框选 · 单击截取窗口 · 拖动自选区域 · Esc / 右键取消",
    "screenHint": "单击截取屏幕 · Esc / 右键取消",
    "cancel": "取消",
    "settings": "设置",
    "includePointer": "包含鼠标指针",
    "pointerOn": "包含指针：开",
    "pointerOff": "包含指针：关",
    "copied": "已复制到剪贴板",
    "captured": "截图完成",
    "notificationBody": "点击预览进行标注",
    "edit": "标注",
    "showFiles": "打开文件夹",
    "area": "手动选择区域",
    "captureWindow": "智能框选窗口",
    "captureScreen": "截取整个屏幕",
    "openEditor": "打开标注工具",
    "history": "最近截图",
    "openFailed": "无法打开标注工具"
};

const strings = {
    region: ['Rectangular snip', '四角形の領域切り取り'],
    window: ['Window snip', 'ウィンドウの切り取り'],
    screen: ['Full-screen snip', '全画面の切り取り'],
    regionHint: ['Drag to select an area', 'ドラッグして領域を選択'],
    windowHint: ['Click a window to capture it', '撮影するウィンドウをクリック'],
    screenHint: ['Click a display to capture it', '撮影する画面をクリック'],
    cancel: ['Close', '閉じる'],
    settings: ['Settings', '設定'],
    includePointer: ['Include mouse pointer', 'マウスポインターを含める'],
    pointerOn: ['Pointer: on', 'ポインター：オン'],
    pointerOff: ['Pointer: off', 'ポインター：オフ'],
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
    if (chinese && zh[key])
        return zh[key];
    const value = strings[key] ?? [key, key];
    return value[japanese ? 1 : 0];
}
