// SPDX-License-Identifier: Apache-2.0 OR GPL-3.0-or-later

import Cairo from 'cairo';
import Gdk from 'gi://Gdk?version=4.0';
import GdkPixbuf from 'gi://GdkPixbuf';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';

import {intersection, normalizeRect} from '../geometry.js';

const DRAWING_TOOLS = new Set([
    'pen', 'highlighter', 'arrow', 'rectangle', 'mosaic', 'crop',
]);

function cloneState(value) {
    return JSON.parse(JSON.stringify(value));
}

function rgba(hex, alpha = 1) {
    const value = hex.replace('#', '');
    return [
        Number.parseInt(value.slice(0, 2), 16) / 255,
        Number.parseInt(value.slice(2, 4), 16) / 255,
        Number.parseInt(value.slice(4, 6), 16) / 255,
        alpha,
    ];
}

function validRect(rect) {
    return rect && rect.width >= 2 && rect.height >= 2;
}

export const ScreenshotCanvas = GObject.registerClass({
    Signals: {
        changed: {},
        'history-changed': {},
        'pending-crop-changed': {},
        'file-changed': {},
    },
}, class ScreenshotCanvas extends Gtk.DrawingArea {
    _init({requestText = null, ...params} = {}) {
        super._init({
            hexpand: true,
            vexpand: true,
            focusable: true,
            content_width: 900,
            content_height: 620,
            ...params,
        });

        this._requestText = requestText;
        this._pixbuf = null;
        this._filePath = null;
        this._annotations = [];
        this._undo = [];
        this._redo = [];
        this._crop = null;
        this._pendingCrop = null;
        this._preview = null;
        this._tool = 'pen';
        this._color = '#ff3b30';
        this._strokeWidth = 4;
        this._zoom = 1;
        this._pointerDown = false;
        this._view = null;

        this.set_draw_func(this._draw.bind(this));

        const click = Gtk.GestureClick.new();
        click.set_button(Gdk.BUTTON_PRIMARY);
        click.connect('pressed', (_gesture, _count, x, y) => this._press(x, y));
        click.connect('released', (_gesture, _count, x, y) => this._release(x, y));
        this.add_controller(click);

        const motion = Gtk.EventControllerMotion.new();
        motion.connect('motion', (_controller, x, y) => this._motion(x, y));
        this.add_controller(motion);
    }

    get filePath() {
        return this._filePath;
    }

    get hasImage() {
        return this._pixbuf !== null;
    }

    get canUndo() {
        return this._undo.length > 0;
    }

    get canRedo() {
        return this._redo.length > 0;
    }

    get imageSize() {
        if (!this._pixbuf)
            return {width: 0, height: 0};
        return {width: this._crop.width, height: this._crop.height};
    }

    get pendingCrop() {
        return this._pendingCrop;
    }

    loadFile(path) {
        const pixbuf = GdkPixbuf.Pixbuf.new_from_file(path);
        this._pixbuf = pixbuf;
        this._filePath = path;
        this._annotations = [];
        this._undo = [];
        this._redo = [];
        this._crop = {x: 0, y: 0, width: pixbuf.width, height: pixbuf.height};
        this._pendingCrop = null;
        this._preview = null;
        this.queue_draw();
        this.emit('file-changed');
        this.emit('history-changed');
    }

    markSaved(path = this._filePath) {
        this._filePath = path;
        this.emit('file-changed');
    }

    setTool(tool) {
        this._tool = tool;
        this._preview = null;
        if (tool !== 'crop')
            this.cancelPendingCrop();
        this.queue_draw();
    }

    setColor(color) {
        this._color = color;
    }

    setStrokeWidth(width) {
        this._strokeWidth = width;
    }

    setZoom(zoom) {
        this._zoom = Math.min(3, Math.max(0.35, zoom));
        this.queue_draw();
    }

    zoomBy(factor) {
        this.setZoom(this._zoom * factor);
    }

    fitToWindow() {
        this._zoom = 1;
        this.queue_draw();
    }

    undo() {
        const state = this._undo.pop();
        if (!state)
            return;
        this._redo.push(this._state());
        this._restore(state);
    }

    redo() {
        const state = this._redo.pop();
        if (!state)
            return;
        this._undo.push(this._state());
        this._restore(state);
    }

    applyPendingCrop() {
        if (!validRect(this._pendingCrop))
            return;
        this._pushUndo();
        this._crop = intersection(this._crop, this._pendingCrop);
        this._pendingCrop = null;
        this.queue_draw();
        this.emit('pending-crop-changed');
        this.emit('changed');
    }

    cancelPendingCrop() {
        if (!this._pendingCrop)
            return;
        this._pendingCrop = null;
        this._preview = null;
        this.queue_draw();
        this.emit('pending-crop-changed');
    }

    addText(x, y, text) {
        if (!text?.trim())
            return;
        this._pushUndo();
        this._annotations.push({
            type: 'text', x, y, text: text.trim(),
            color: this._color,
            size: Math.max(18, this._strokeWidth * 5),
        });
        this.queue_draw();
        this.emit('changed');
    }

    addAnnotation(annotation) {
        this._pushUndo();
        this._annotations.push(cloneState(annotation));
        this.queue_draw();
        this.emit('changed');
    }

    setPendingCrop(rect) {
        const clipped = intersection(this._crop, rect);
        this._pendingCrop = validRect(clipped) ? clipped : null;
        this.queue_draw();
        this.emit('pending-crop-changed');
    }

    exportPng(path) {
        if (!this._pixbuf)
            throw new Error('No image loaded');
        const width = Math.max(1, Math.round(this._crop.width));
        const height = Math.max(1, Math.round(this._crop.height));
        const surface = new Cairo.ImageSurface(Cairo.Format.ARGB32, width, height);
        const context = new Cairo.Context(surface);
        context.rectangle(0, 0, width, height);
        context.clip();
        context.translate(-this._crop.x, -this._crop.y);
        this._drawImageAndAnnotations(context, false);
        surface.writeToPNG(path);
        surface.finish();
        return path;
    }

    _state() {
        return cloneState({annotations: this._annotations, crop: this._crop});
    }

    _restore(state) {
        this._annotations = cloneState(state.annotations);
        this._crop = cloneState(state.crop);
        this._pendingCrop = null;
        this._preview = null;
        this.queue_draw();
        this.emit('history-changed');
        this.emit('pending-crop-changed');
        this.emit('changed');
    }

    _pushUndo() {
        this._undo.push(this._state());
        if (this._undo.length > 100)
            this._undo.shift();
        this._redo = [];
        this.emit('history-changed');
    }

    _toImage(x, y) {
        if (!this._view)
            return null;
        const imageX = (x - this._view.x) / this._view.scale + this._crop.x;
        const imageY = (y - this._view.y) / this._view.scale + this._crop.y;
        if (imageX < this._crop.x || imageY < this._crop.y ||
            imageX > this._crop.x + this._crop.width ||
            imageY > this._crop.y + this._crop.height)
            return null;
        return {x: imageX, y: imageY};
    }

    _press(x, y) {
        if (!this._pixbuf)
            return;
        const point = this._toImage(x, y);
        if (!point)
            return;
        this.grab_focus();

        if (this._tool === 'text') {
            this._requestText?.(point.x, point.y,
                text => this.addText(point.x, point.y, text));
            return;
        }
        if (!DRAWING_TOOLS.has(this._tool))
            return;

        this._pointerDown = true;
        this._start = point;
        if (this._tool === 'pen' || this._tool === 'highlighter') {
            this._preview = {
                type: this._tool,
                points: [point],
                color: this._color,
                width: this._strokeWidth,
            };
        } else {
            this._preview = {
                type: this._tool,
                start: point,
                end: point,
                color: this._color,
                width: this._strokeWidth,
            };
        }
        this.queue_draw();
    }

    _motion(x, y) {
        if (!this._pointerDown || !this._preview)
            return;
        const point = this._toImage(x, y);
        if (!point)
            return;
        if (this._tool === 'pen' || this._tool === 'highlighter')
            this._preview.points.push(point);
        else
            this._preview.end = point;
        this.queue_draw();
    }

    _release(x, y) {
        if (!this._pointerDown || !this._preview)
            return;
        this._pointerDown = false;
        const point = this._toImage(x, y);
        if (point && this._preview.end)
            this._preview.end = point;

        if (this._tool === 'crop') {
            const rect = normalizeRect(
                this._preview.start.x, this._preview.start.y,
                this._preview.end.x, this._preview.end.y, this._crop);
            this._pendingCrop = validRect(rect) ? rect : null;
            this._preview = null;
            this.emit('pending-crop-changed');
        } else if (this._isUsefulAnnotation(this._preview)) {
            this._pushUndo();
            this._annotations.push(this._preview);
            this._preview = null;
            this.emit('changed');
        } else {
            this._preview = null;
        }
        this.queue_draw();
    }

    _isUsefulAnnotation(annotation) {
        if (annotation.points)
            return annotation.points.length >= 2;
        const dx = annotation.end.x - annotation.start.x;
        const dy = annotation.end.y - annotation.start.y;
        return Math.hypot(dx, dy) >= 2;
    }

    _draw(_area, context, width, height) {
        context.setSourceRGB(0.11, 0.11, 0.12);
        context.paint();
        if (!this._pixbuf)
            return;

        const padding = 36;
        const fit = Math.min(
            (width - padding * 2) / this._crop.width,
            (height - padding * 2) / this._crop.height);
        const scale = Math.max(0.02, fit * this._zoom);
        const drawWidth = this._crop.width * scale;
        const drawHeight = this._crop.height * scale;
        const x = (width - drawWidth) / 2;
        const y = (height - drawHeight) / 2;
        this._view = {x, y, scale};

        context.save();
        context.setSourceRGBA(0, 0, 0, 0.35);
        context.rectangle(x + 7, y + 8, drawWidth, drawHeight);
        context.fill();
        context.restore();

        context.save();
        context.rectangle(x, y, drawWidth, drawHeight);
        context.clip();
        context.translate(x, y);
        context.scale(scale, scale);
        context.translate(-this._crop.x, -this._crop.y);
        this._drawImageAndAnnotations(context, true);
        context.restore();
    }

    _drawImageAndAnnotations(context, includePreview) {
        Gdk.cairo_set_source_pixbuf(context, this._pixbuf, 0, 0);
        context.paint();
        for (const annotation of this._annotations)
            this._drawAnnotation(context, annotation);
        if (includePreview && this._preview)
            this._drawAnnotation(context, this._preview);
        if (includePreview && this._pendingCrop)
            this._drawCrop(context, this._pendingCrop);
    }

    _drawAnnotation(context, annotation) {
        if (annotation.type === 'pen' || annotation.type === 'highlighter') {
            const [red, green, blue, alpha] = rgba(
                annotation.color, annotation.type === 'highlighter' ? 0.32 : 1);
            context.save();
            context.setSourceRGBA(red, green, blue, alpha);
            context.setLineWidth(annotation.type === 'highlighter'
                ? annotation.width * 4
                : annotation.width);
            context.setLineCap(Cairo.LineCap.ROUND);
            context.setLineJoin(Cairo.LineJoin.ROUND);
            context.moveTo(annotation.points[0].x, annotation.points[0].y);
            for (const point of annotation.points.slice(1))
                context.lineTo(point.x, point.y);
            context.stroke();
            context.restore();
            return;
        }

        if (annotation.type === 'text') {
            const [red, green, blue] = rgba(annotation.color);
            context.save();
            context.setSourceRGB(red, green, blue);
            context.selectFontFace('Sans', Cairo.FontSlant.NORMAL, Cairo.FontWeight.BOLD);
            context.setFontSize(annotation.size);
            const lines = annotation.text.split('\n');
            lines.forEach((line, index) => {
                context.moveTo(annotation.x, annotation.y + annotation.size * (index + 1));
                context.showText(line);
            });
            context.restore();
            return;
        }

        const rect = normalizeRect(
            annotation.start.x, annotation.start.y,
            annotation.end.x, annotation.end.y);
        if (annotation.type === 'mosaic') {
            this._drawMosaic(context, rect);
            return;
        }
        if (annotation.type === 'crop') {
            this._drawCrop(context, rect);
            return;
        }

        const [red, green, blue] = rgba(annotation.color);
        context.save();
        context.setSourceRGB(red, green, blue);
        context.setLineWidth(annotation.width);
        context.setLineCap(Cairo.LineCap.ROUND);
        context.setLineJoin(Cairo.LineJoin.ROUND);

        if (annotation.type === 'rectangle') {
            context.rectangle(rect.x, rect.y, rect.width, rect.height);
            context.stroke();
        } else if (annotation.type === 'arrow') {
            const dx = annotation.end.x - annotation.start.x;
            const dy = annotation.end.y - annotation.start.y;
            const angle = Math.atan2(dy, dx);
            const head = Math.max(12, annotation.width * 4);
            context.moveTo(annotation.start.x, annotation.start.y);
            context.lineTo(annotation.end.x, annotation.end.y);
            context.stroke();
            context.moveTo(annotation.end.x, annotation.end.y);
            context.lineTo(
                annotation.end.x - head * Math.cos(angle - Math.PI / 6),
                annotation.end.y - head * Math.sin(angle - Math.PI / 6));
            context.lineTo(
                annotation.end.x - head * Math.cos(angle + Math.PI / 6),
                annotation.end.y - head * Math.sin(angle + Math.PI / 6));
            context.closePath();
            context.fill();
        }
        context.restore();
    }

    _drawCrop(context, rect) {
        context.save();
        context.setSourceRGBA(0, 0, 0, 0.54);
        context.rectangle(this._crop.x, this._crop.y, this._crop.width, this._crop.height);
        context.rectangle(rect.x, rect.y, rect.width, rect.height);
        context.setFillRule(Cairo.FillRule.EVEN_ODD);
        context.fill();
        context.setSourceRGB(0.38, 0.8, 1);
        context.setLineWidth(2);
        context.rectangle(rect.x, rect.y, rect.width, rect.height);
        context.stroke();
        context.restore();
    }

    _drawMosaic(context, rect) {
        const clipped = intersection(rect, {
            x: 0, y: 0, width: this._pixbuf.width, height: this._pixbuf.height,
        });
        if (!validRect(clipped))
            return;

        const x = Math.round(clipped.x);
        const y = Math.round(clipped.y);
        const width = Math.max(1, Math.round(clipped.width));
        const height = Math.max(1, Math.round(clipped.height));
        const source = this._pixbuf.new_subpixbuf(x, y, width, height);
        const blockSize = 12;
        const small = source.scale_simple(
            Math.max(1, Math.round(width / blockSize)),
            Math.max(1, Math.round(height / blockSize)),
            GdkPixbuf.InterpType.NEAREST);

        context.save();
        context.rectangle(x, y, width, height);
        context.clip();
        context.translate(x, y);
        context.scale(width / small.width, height / small.height);
        Gdk.cairo_set_source_pixbuf(context, small, 0, 0);
        context.getSource().setFilter(Cairo.Filter.NEAREST);
        context.paint();
        context.restore();
    }
});
