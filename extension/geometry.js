// SPDX-License-Identifier: Apache-2.0 OR GPL-3.0-or-later

export function clamp(value, minimum, maximum) {
    return Math.min(Math.max(value, minimum), maximum);
}

export function normalizeRect(x1, y1, x2, y2, bounds = null) {
    let left = Math.min(x1, x2);
    let top = Math.min(y1, y2);
    let right = Math.max(x1, x2);
    let bottom = Math.max(y1, y2);

    if (bounds) {
        left = clamp(left, bounds.x, bounds.x + bounds.width);
        top = clamp(top, bounds.y, bounds.y + bounds.height);
        right = clamp(right, bounds.x, bounds.x + bounds.width);
        bottom = clamp(bottom, bounds.y, bounds.y + bounds.height);
    }

    return {
        x: Math.round(left),
        y: Math.round(top),
        width: Math.round(Math.max(0, right - left)),
        height: Math.round(Math.max(0, bottom - top)),
    };
}

export function containsPoint(rect, x, y) {
    return x >= rect.x && y >= rect.y &&
        x < rect.x + rect.width && y < rect.y + rect.height;
}

export function intersection(first, second) {
    const x = Math.max(first.x, second.x);
    const y = Math.max(first.y, second.y);
    const right = Math.min(first.x + first.width, second.x + second.width);
    const bottom = Math.min(first.y + first.height, second.y + second.height);

    return {
        x,
        y,
        width: Math.max(0, right - x),
        height: Math.max(0, bottom - y),
    };
}

export function rectForPoint(rectangles, x, y) {
    return rectangles.find(rect => containsPoint(rect, x, y)) ?? null;
}

export function sanitizeFilename(value) {
    const cleaned = value
        .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-')
        .replace(/\s+/g, ' ')
        .replace(/^\.+/, '')
        .trim();
    return cleaned || 'Screenshot';
}
