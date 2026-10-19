// SPDX-License-Identifier: Apache-2.0 OR GPL-3.0-or-later
// Shared by the transparent on-screen canvas and the PNG exporter.
import Cairo from 'cairo';
import Pango from 'gi://Pango';
import PangoCairo from 'gi://PangoCairo';

export function drawAnnotation(cr, a, pixels = null, image = {}) {
    cr.save();
    const hex = (a.color ?? '#ff3b30').replace('#', '');
    cr.setSourceRGB(...[0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16) / 255));
    cr.setLineWidth(a.width ?? 3);
    cr.setLineCap(Cairo.LineCap.ROUND);
    cr.setLineJoin(Cairo.LineJoin.ROUND);
    if (a.type === 'text') {
        const layout = PangoCairo.create_layout(cr);
        const font = Pango.FontDescription.from_string('Sans');
        font.set_absolute_size((a.size ?? 22) * Pango.SCALE);
        layout.set_font_description(font);
        layout.set_text(a.text, -1);
        cr.moveTo(a.x, a.y);
        PangoCairo.show_layout(cr, layout);
    } else if (a.points?.length) {
        cr.moveTo(a.points[0].x, a.points[0].y);
        for (const p of a.points.slice(1))
            cr.lineTo(p.x, p.y);
        cr.stroke();
    } else if (a.start && a.end) {
        const x = Math.min(a.start.x, a.end.x);
        const y = Math.min(a.start.y, a.end.y);
        const w = Math.abs(a.end.x - a.start.x);
        const h = Math.abs(a.end.y - a.start.y);
        if (a.type === 'rectangle') {
            cr.rectangle(x, y, w, h);
            cr.stroke();
        } else if (a.type === 'ellipse' && w > 0 && h > 0) {
            cr.save();
            cr.translate(x + w / 2, y + h / 2);
            cr.scale(w / 2, h / 2);
            cr.arc(0, 0, 1, 0, Math.PI * 2);
            cr.restore();
            cr.stroke();
        } else if (a.type === 'arrow') {
            const angle = Math.atan2(a.end.y - a.start.y, a.end.x - a.start.x);
            const head = Math.max(12, (a.width ?? 3) * 4);
            cr.moveTo(a.start.x, a.start.y);
            cr.lineTo(a.end.x, a.end.y);
            cr.stroke();
            cr.moveTo(a.end.x, a.end.y);
            cr.lineTo(a.end.x - head * Math.cos(angle - Math.PI / 6),
                a.end.y - head * Math.sin(angle - Math.PI / 6));
            cr.lineTo(a.end.x - head * Math.cos(angle + Math.PI / 6),
                a.end.y - head * Math.sin(angle + Math.PI / 6));
            cr.closePath();
            cr.fill();
        } else if (a.type === 'mosaic' && pixels && w > 0 && h > 0) {
            // Sample the original pixels, never the shaded UI or other annotations.
            const bytes = pixels.get_pixels();
            const channels = pixels.n_channels;
            const stride = pixels.rowstride;
            const scale = image.scale ?? 1;
            const block = 12;
            cr.rectangle(x, y, w, h);
            cr.clip();
            for (let py = y; py < y + h; py += block) {
                for (let px = x; px < x + w; px += block) {
                    const sx = Math.max(0, Math.min(pixels.width - 1,
                        Math.floor((px + block / 2 - (image.x ?? 0)) * scale)));
                    const sy = Math.max(0, Math.min(pixels.height - 1,
                        Math.floor((py + block / 2 - (image.y ?? 0)) * scale)));
                    const offset = sy * stride + sx * channels;
                    cr.setSourceRGB(bytes[offset] / 255, bytes[offset + 1] / 255,
                        bytes[offset + 2] / 255);
                    cr.rectangle(px, py, Math.min(block, x + w - px),
                        Math.min(block, y + h - py));
                    cr.fill();
                }
            }
        }
    }
    cr.restore();
}
