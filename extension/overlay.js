// SPDX-License-Identifier: Apache-2.0 OR GPL-3.0-or-later

import Cairo from 'cairo';
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {normalizeRect, rectForPoint, containsPoint, clamp} from './geometry.js';
import {drawAnnotation} from './annotations.js';
import {t} from './i18n.js';

const MODES = ['region', 'window', 'screen'];

function modeIcon(mode) {
    return {
        region: 'selection-mode-symbolic',
        window: 'focus-windows-symbolic',
        screen: 'view-fullscreen-symbolic',
    }[mode];
}

function modeLabel(mode) {
    return t(mode);
}

export const SnippingOverlay = GObject.registerClass(
class SnippingOverlay extends St.Widget {
    _init(params = {}) {
        super._init({
            name: 'simple-screenshot-overlay',
            reactive: true,
            can_focus: true,
            track_hover: true,
            layout_manager: new Clutter.BinLayout(),
        });

        this._onCapture = params.onCapture;
        this._onCancel = params.onCancel;
        this._onSettings = params.onSettings;
        this._mode = MODES.includes(params.initialMode)
            ? params.initialMode
            : 'region';
        this._dragging = false;
        this._dragMoved = false;
        this._pressedRect = null;
        this._start = null;
        this._currentRect = null;
        this._grab = null;
        this._locked = false;
        this._annotations = [];
        this._redo = [];
        this._tool = null;
        this._color = '#ff3b30';
        this._strokeWidth = 3;
        this._preview = null;
        this._editOperation = null;
        this._textEntry = null;

        this._background = new St.Widget({x_expand: true, y_expand: true});
        this.add_child(this._background);

        this._fullShade = new St.Widget({
            style_class: 'simple-screenshot-shade',
            x_expand: true,
            y_expand: true,
        });
        this.add_child(this._fullShade);

        this._shades = Array.from({length: 4}, () => {
            const shade = new St.Widget({
                style_class: 'simple-screenshot-shade',
                visible: false,
            });
            this.add_child(shade);
            return shade;
        });

        this._selection = new St.Widget({
            style_class: 'simple-screenshot-selection',
            visible: false,
        });
        this.add_child(this._selection);

        this._sizeLabel = new St.Label({
            style_class: 'simple-screenshot-size-label',
            visible: false,
        });
        this.add_child(this._sizeLabel);

        this._canvas = new St.DrawingArea({reactive: false});
        this._canvas.connect('repaint', () => this._paintAnnotations());
        this.add_child(this._canvas);
        this._handles = Array.from({length: 8}, () => {
            const handle = new St.Widget({
                style_class: 'qq-screenshot-handle', width: 6, height: 6,
                reactive: false, visible: false,
            });
            this.add_child(handle);
            return handle;
        });
        this._actionHost = this._buildActionbar();
        this._actionHost.hide();
        this.add_child(this._actionHost);

        this._toolbar = this._buildToolbar();
        this._toolbarHost = new St.BoxLayout({
            vertical: true,
            x_expand: true,
            y_expand: true,
            y_align: Clutter.ActorAlign.START,
        });
        this._toolbarHost.add_child(this._toolbar);
        this.add_child(this._toolbarHost);

        this._hint = new St.Label({
            style_class: 'simple-screenshot-hint',
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.END,
            y_expand: true,
        });
        this.add_child(this._hint);

        this.connect('button-press-event', this._onButtonPress.bind(this));
        this.connect('motion-event', this._onMotion.bind(this));
        this.connect('button-release-event', this._onButtonRelease.bind(this));
        this.connect('key-press-event', this._onKeyPress.bind(this));
        this.connect('destroy', () => this._releaseModal());
        this._syncMode();
    }

    _buildToolbar() {
        const box = new St.BoxLayout({
            style_class: 'simple-screenshot-toolbar',
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.START,
        });
        this._modeButtons = new Map();

        for (const mode of MODES) {
            const child = new St.BoxLayout({
                style_class: 'simple-screenshot-tool-content',
                vertical: true,
            });
            child.add_child(new St.Icon({
                icon_name: modeIcon(mode),
                style_class: 'simple-screenshot-tool-icon',
            }));
            child.add_child(new St.Label({
                text: modeLabel(mode),
                style_class: 'simple-screenshot-tool-label',
            }));

            const button = new St.Button({
                style_class: 'simple-screenshot-tool-button',
                child,
                can_focus: true,
            });
            button.connect('clicked', () => this.setMode(mode));
            box.add_child(button);
            this._modeButtons.set(mode, button);
        }

        box.add_child(new St.Widget({style_class: 'simple-screenshot-divider'}));
        box.add_child(this._iconButton(
            'preferences-system-symbolic', t('settings'), () => {
                const callback = this._onSettings;
                this._close();
                callback?.();
            }));
        box.add_child(this._iconButton(
            'window-close-symbolic', t('cancel'), () => this.cancel()));
        return box;
    }

    _iconButton(iconName, accessibleName, callback) {
        const button = new St.Button({
            style_class: 'simple-screenshot-icon-button',
            child: new St.Icon({
                icon_name: iconName,
                style_class: 'simple-screenshot-action-icon',
            }),
            can_focus: true,
            accessible_name: accessibleName,
        });
        button.connect('clicked', callback);
        return button;
    }

    open(snapshot) {
        this._snapshot = snapshot;
        this._background.set_content(snapshot.content);
        Main.layoutManager.addTopChrome(this, {trackFullscreen: true});
        this.set_position(0, 0);
        this.set_size(global.stage.width, global.stage.height);
        this._canvas.set_position(0, 0);
        this._canvas.set_size(global.stage.width, global.stage.height);
        this._grab = Main.pushModal(this, {actionMode: Shell.ActionMode.NORMAL});
        this.grab_key_focus();
        this.opacity = 255;
        this._syncHoverRect(...global.get_pointer());
    }

    setMode(mode) {
        if (!MODES.includes(mode))
            return;
        this._mode = mode;
        this._dragging = false;
        this._currentRect = null;
        this._selection.hide();
        this._sizeLabel.hide();
        this._fullShade.show();
        this._shades.forEach(shade => shade.hide());
        this._syncMode();
        this._syncHoverRect(...global.get_pointer());
        this.grab_key_focus();
    }

    _syncMode() {
        for (const [mode, button] of this._modeButtons) {
            if (mode === this._mode)
                button.add_style_pseudo_class('checked');
            else
                button.remove_style_pseudo_class('checked');
        }

        this._hint.text = {
            region: t('regionHint'),
            window: t('windowHint'),
            screen: t('screenHint'),
        }[this._mode];
    }

    _onButtonPress(_actor, event) {
        if (this._isControl(event.get_source()))
            return Clutter.EVENT_PROPAGATE;
        if (event.get_button() === Clutter.BUTTON_SECONDARY) {
            this.cancel();
            return Clutter.EVENT_STOP;
        }
        if (event.get_button() !== Clutter.BUTTON_PRIMARY)
            return Clutter.EVENT_PROPAGATE;

        const source = event.get_source();
        if (source && (source === this._toolbar || this._toolbar.contains(source)))
            return Clutter.EVENT_PROPAGATE;

        const [x, y] = event.get_coords();
        if (this._locked) {
            const last = this._lastSelectionClick;
            const time = event.get_time();
            if (last && ((time - last.time) >>> 0) <= 400 &&
                Math.hypot(x - last.x, y - last.y) <= 6 && !this._textEntry &&
                containsPoint(this._currentRect, x, y) && !this._resizeEdges(x, y)) {
                this._finishCapture();
                return Clutter.EVENT_STOP;
            }
            return this._editPress(x, y);
        }
        if (this._mode === 'region' || this._mode === 'window') {
            this._dragging = true;
            this._dragMoved = false;
            this._start = {x, y};
            this._pressedRect = this._currentRect;
            if (this._mode === 'region')
                this._showRect({x, y, width: 1, height: 1}, true);
        } else if (this._currentRect) {
            this._requestCapture(this._currentRect);
        }
        return Clutter.EVENT_STOP;
    }

    _onMotion(_actor, event) {
        const [x, y] = event.get_coords();
        if (this._locked)
            return this._editMotion(x, y);
        if (this._dragging) {
            if (Math.hypot(x - this._start.x, y - this._start.y) >= 6)
                this._dragMoved = true;
            if (!this._dragMoved && this._mode === 'window')
                return Clutter.EVENT_STOP;
            const rect = normalizeRect(
                this._start.x, this._start.y, x, y,
                {x: 0, y: 0, width: this.width, height: this.height});
            this._showRect(rect, true);
        } else if (this._mode !== 'region') {
            this._syncHoverRect(x, y);
        }
        return Clutter.EVENT_STOP;
    }

    _onButtonRelease(_actor, event) {
        if (this._locked && event.get_button() === Clutter.BUTTON_PRIMARY)
            return this._editRelease(...event.get_coords(), event.get_time());
        if (event.get_button() !== Clutter.BUTTON_PRIMARY || !this._dragging)
            return Clutter.EVENT_PROPAGATE;

        this._dragging = false;
        const [x, y] = event.get_coords();
        const rect = normalizeRect(
            this._start.x, this._start.y, x, y,
            {x: 0, y: 0, width: this.width, height: this.height});
        const dragged = this._dragMoved || Math.hypot(x - this._start.x, y - this._start.y) >= 6;
        this._lastSelectionClick = !dragged ? {x, y, time: event.get_time()} : null;
        if (this._mode === 'window' && !dragged && this._pressedRect)
            this._requestCapture(this._pressedRect);
        else if (rect.width >= 4 && rect.height >= 4)
            this._requestCapture(rect);
        else
            this._resetSelection();
        return Clutter.EVENT_STOP;
    }

    _onKeyPress(_actor, event) {
        const symbol = event.get_key_symbol();
        if (this._textEntry) {
            if (symbol === Clutter.KEY_Escape) {
                this._textEntry.destroy();
                this._textEntry = null;
                this.grab_key_focus();
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        }
        if (this._locked) {
            const control = Boolean(event.get_state() & Clutter.ModifierType.CONTROL_MASK);
            if (symbol === Clutter.KEY_Escape) {
                this.cancel();
            } else if (symbol === Clutter.KEY_Return || symbol === Clutter.KEY_KP_Enter ||
                (control && (symbol === Clutter.KEY_c || symbol === Clutter.KEY_C))) {
                this._finishCapture();
            } else if (control && (symbol === Clutter.KEY_s || symbol === Clutter.KEY_S)) {
                this._finishCapture(true);
            } else if (control && (symbol === Clutter.KEY_z || symbol === Clutter.KEY_Z)) {
                if (event.get_state() & Clutter.ModifierType.SHIFT_MASK)
                    this._redoAnnotation();
                else
                    this._undoAnnotation();
            } else {
                const tools = {r:'rectangle',e:'ellipse',a:'arrow',p:'pen',m:'mosaic',t:'text'};
                const tool = tools[String.fromCharCode(symbol).toLowerCase()];
                if (tool) this._selectTool(tool);
                else return Clutter.EVENT_PROPAGATE;
            }
            return Clutter.EVENT_STOP;
        }
        if (symbol === Clutter.KEY_Escape) {
            this.cancel();
            return Clutter.EVENT_STOP;
        }
        if ((symbol === Clutter.KEY_Return || symbol === Clutter.KEY_KP_Enter) && this._currentRect) {
            this._requestCapture(this._currentRect);
            return Clutter.EVENT_STOP;
        }
        if (symbol === Clutter.KEY_r || symbol === Clutter.KEY_R)
            this.setMode('region');
        else if (symbol === Clutter.KEY_w || symbol === Clutter.KEY_W)
            this.setMode('window');
        else if (symbol === Clutter.KEY_f || symbol === Clutter.KEY_F)
            this.setMode('screen');
        else
            return Clutter.EVENT_PROPAGATE;
        return Clutter.EVENT_STOP;
    }

    _syncHoverRect(x, y) {
        if (this._mode === 'window') {
            const windows = global.get_window_actors()
                .filter(actor => actor.visible)
                .map(actor => actor.meta_window)
                .filter(window => window &&
                    window.showing_on_its_workspace() && !window.minimized &&
                    !window.is_override_redirect() &&
                    window.get_window_type() !== Meta.WindowType.DESKTOP)
                .map(window => {
                    const frame = window.get_frame_rect();
                    return normalizeRect(frame.x, frame.y,
                        frame.x + frame.width, frame.y + frame.height,
                        {x: 0, y: 0, width: this.width, height: this.height});
                });
            this._currentRect = rectForPoint(windows.reverse(), x, y) ??
                {x: 0, y: 0, width: this.width, height: this.height};
        } else if (this._mode === 'screen') {
            this._currentRect = rectForPoint(Main.layoutManager.monitors, x, y);
        }

        if (this._currentRect)
            this._showRect(this._currentRect, true);
        else
            this._resetSelection();
    }

    _showRect(rect, showSize) {
        this._currentRect = rect;
        this._fullShade.hide();
        this._shades.forEach(shade => shade.show());
        this._selection.show();
        this._selection.set_position(rect.x, rect.y);
        this._selection.set_size(rect.width, rect.height);

        const [top, bottom, left, right] = this._shades;
        top.set_position(0, 0);
        // Setting the initial (0, 0) position can be a no-op; prevent BinLayout centering.
        top.fixed_position_set = true;
        top.set_size(this.width, rect.y);
        bottom.set_position(0, rect.y + rect.height);
        bottom.set_size(this.width, Math.max(0, this.height - rect.y - rect.height));
        left.set_position(0, rect.y);
        left.set_size(rect.x, rect.height);
        right.set_position(rect.x + rect.width, rect.y);
        right.set_size(Math.max(0, this.width - rect.x - rect.width), rect.height);

        if (showSize && rect.width > 20 && rect.height > 20) {
            this._sizeLabel.text = `${rect.width} × ${rect.height}`;
            this._sizeLabel.show();
            const labelWidth = Math.max(92, this._sizeLabel.width);
            const labelX = Math.min(
                Math.max(8, rect.x), Math.max(8, this.width - labelWidth - 8));
            const labelY = rect.y + rect.height + 10 < this.height - 42
                ? rect.y + rect.height + 8
                : Math.max(8, rect.y - 38);
            this._sizeLabel.set_position(labelX, labelY);
        } else {
            this._sizeLabel.hide();
        }
    }

    _resetSelection() {
        this._currentRect = null;
        this._selection.hide();
        this._sizeLabel.hide();
        this._fullShade.show();
        this._shades.forEach(shade => shade.hide());
    }

    _isControl(source) {
        return source && [this._toolbar, this._actionHost, this._textEntry]
            .some(actor => actor && (actor === source || actor.contains(source)));
    }

    _buildActionbar() {
        const host = new St.BoxLayout({vertical: true, style_class: 'qq-screenshot-actions'});
        const row = new St.BoxLayout({style_class: 'qq-screenshot-action-row'});
        this._toolButtons = new Map();
        for (const [tool, label, name] of [
            ['rectangle','□','矩形 R'], ['ellipse','○','椭圆 E'],
            ['arrow','↗','箭头 A'], ['pen','✎','画笔 P'],
            ['mosaic','▦','马赛克 M'], ['text','T','文字 T'],
        ]) {
            const button = this._actionButton(label, name, () => this._selectTool(tool));
            row.add_child(button);
            this._toolButtons.set(tool, button);
        }
        row.add_child(this._actionButton('↶','撤销 Ctrl+Z',()=>this._undoAnnotation()));
        row.add_child(this._actionButton('↓','保存并复制 Ctrl+S',()=>this._finishCapture(true)));
        const cancel = this._actionButton('×','取消 Esc',()=>this.cancel());
        cancel.add_style_class_name('qq-screenshot-cancel');
        row.add_child(cancel);
        const done = this._actionButton('✓','完成并复制 Enter / Ctrl+C',()=>this._finishCapture());
        done.add_style_class_name('qq-screenshot-done');
        row.add_child(done);
        host.add_child(row);
        this._palette = new St.BoxLayout({style_class: 'qq-screenshot-palette',visible: false});
        this._colorButtons = new Map();
        for (const color of ['#ff3b30','#ffcc00','#34c759','#00a2ff','#af52de','#ffffff','#000000']) {
            const button = new St.Button({
                style_class: 'qq-screenshot-color', can_focus: true,
                accessible_name: color, style: `background-color: ${color};`,
            });
            button.connect('clicked', () => {
                this._color=color;
                for (const [value, actor] of this._colorButtons)
                    actor.set_style(`background-color: ${value}; border-color: ${value===color?'#00a2ff':'#666666'};`);
            });
            this._colorButtons.set(color,button);
            this._palette.add_child(button);
        }
        for (const width of [2,4,7]) {
            const button = new St.Button({
                label: `${width}`, style_class:'qq-screenshot-width',
                accessible_name:`线条粗细 ${width}`, can_focus:true,
            });
            button.connect('clicked',()=>{this._strokeWidth=width;});
            this._palette.add_child(button);
        }
        host.add_child(this._palette);
        return host;
    }

    _actionButton(label, name, callback) {
        const button = new St.Button({
            child:new St.Label({text:label}), style_class:'qq-screenshot-action',
            accessible_name:name, can_focus:true,
        });
        button.connect('clicked', callback);
        return button;
    }

    _selectTool(tool) {
        this._commitText();
        this._tool = this._tool===tool ? null : tool;
        for (const [value, button] of this._toolButtons) {
            if (value===this._tool) button.add_style_pseudo_class('checked');
            else button.remove_style_pseudo_class('checked');
        }
        this._palette.visible = Boolean(this._tool && this._tool!=='mosaic');
        this._positionActionbar();
        this.grab_key_focus();
    }

    _positionActionbar() {
        const r = this._currentRect;
        const width = 430;
        const height = this._palette.visible ? 82 : 46;
        this._actionHost.set_width(width);
        const x = clamp(r.x+r.width-width,8,Math.max(8,this.width-width-8));
        let y = r.y+r.height+9;
        if (y+height>this.height-8) y=r.y-height-9;
        if (y<8) y=clamp(r.y+r.height-height-9,8,Math.max(8,this.height-height-8));
        this._actionHost.set_position(x,y);
    }

    _updateHandles() {
        const r=this._currentRect;
        const positions=[
            [r.x,r.y],[r.x+r.width/2,r.y],[r.x+r.width,r.y],
            [r.x,r.y+r.height/2],[r.x+r.width,r.y+r.height/2],
            [r.x,r.y+r.height],[r.x+r.width/2,r.y+r.height],[r.x+r.width,r.y+r.height],
        ];
        this._handles.forEach((handle,i)=>{
            handle.set_position(positions[i][0]-3,positions[i][1]-3);
            handle.show();
        });
    }

    _resizeEdges(x,y) {
        const r=this._currentRect;
        if (x<r.x-7 || x>r.x+r.width+7 || y<r.y-7 || y>r.y+r.height+7)
            return null;
        const edges={left:Math.abs(x-r.x)<=7,right:Math.abs(x-r.x-r.width)<=7,
            top:Math.abs(y-r.y)<=7,bottom:Math.abs(y-r.y-r.height)<=7};
        return Object.values(edges).some(Boolean) ? edges : null;
    }

    _editPress(x,y) {
        this._editClickStart = {x, y};
        this._commitText();
        const edges=this._resizeEdges(x,y);
        if (edges) {
            this._editOperation={type:'resize',edges,x,y,rect:{...this._currentRect}};
            return Clutter.EVENT_STOP;
        }
        if (!containsPoint(this._currentRect,x,y)) return Clutter.EVENT_STOP;
        if (!this._tool) {
            this._editOperation={type:'move',x,y,rect:{...this._currentRect}};
        } else if (this._tool==='text') {
            this._beginText(x,y);
        } else {
            this._preview={type:this._tool,color:this._color,width:this._strokeWidth,
                start:{x,y},end:{x,y}};
            if(this._tool==='pen') this._preview.points=[{x,y}];
        }
        return Clutter.EVENT_STOP;
    }

    _editMotion(x,y) {
        if (this._editClickStart &&
            Math.hypot(x - this._editClickStart.x, y - this._editClickStart.y) > 6)
            this._lastSelectionClick = null;
        const op=this._editOperation;
        if(op) {
            let r;
            if(op.type==='move') {
                r={...op.rect,x:clamp(op.rect.x+x-op.x,0,this.width-op.rect.width),
                    y:clamp(op.rect.y+y-op.y,0,this.height-op.rect.height)};
            } else {
                const f=op.rect,e=op.edges;
                const left=e.left?clamp(x,0,f.x+f.width-8):f.x;
                const right=e.right?clamp(x,left+8,this.width):f.x+f.width;
                const top=e.top?clamp(y,0,f.y+f.height-8):f.y;
                const bottom=e.bottom?clamp(y,top+8,this.height):f.y+f.height;
                r=normalizeRect(left,top,right,bottom);
            }
            this._showRect(r,true);
            this._positionActionbar();
            this._updateHandles();
            this._canvas.queue_repaint();
        } else if(this._preview) {
            const r=this._currentRect;
            const p={x:clamp(x,r.x,r.x+r.width),y:clamp(y,r.y,r.y+r.height)};
            this._preview.end=p;
            if(this._preview.points) this._preview.points.push(p);
            this._canvas.queue_repaint();
        }
        return Clutter.EVENT_STOP;
    }

    _editRelease(x,y,time = 0) {
        const click = this._editClickStart &&
            Math.hypot(x - this._editClickStart.x, y - this._editClickStart.y) <= 6;
        this._lastSelectionClick = click && this._editOperation?.type !== 'resize'
            ? {x, y, time} : null;
        this._editClickStart = null;
        if(this._editOperation || this._preview) this._editMotion(x,y);
        this._editOperation=null;
        if(this._preview) {
            const a=this._preview;
            if((a.points?.length??0)>1 || Math.hypot(a.end.x-a.start.x,a.end.y-a.start.y)>=2) {
                this._annotations.push(a);
                this._redo=[];
            }
            this._preview=null;
            this._canvas.queue_repaint();
        }
        return Clutter.EVENT_STOP;
    }

    _beginText(x,y) {
        const r=this._currentRect;
        const entry=new St.Entry({
            style_class:'qq-screenshot-text',hint_text:'输入文字，回车确认',
            can_focus:true, width:Math.min(280,r.width),
            style:`color: ${this._color};`,
        });
        entry.set_position(clamp(x,r.x,r.x+r.width-Math.min(280,r.width)),
            clamp(y,r.y,Math.max(r.y,r.y+r.height-36)));
        this.add_child(entry);
        this._textEntry=entry;
        this._textPoint={x,y};
        entry.clutter_text.connect('activate',()=>this._commitText());
        entry.clutter_text.grab_key_focus();
    }

    _commitText() {
        if(!this._textEntry) return;
        const text=this._textEntry.get_text();
        if(text.trim()) {
            this._annotations.push({type:'text',...this._textPoint,text,
                color:this._color,size:Math.max(20,this._strokeWidth*5)});
            this._redo=[];
        }
        this._textEntry.destroy();
        this._textEntry=null;
        this._canvas.queue_repaint();
        this.grab_key_focus();
    }

    _undoAnnotation() {
        this._commitText();
        if(this._annotations.length) this._redo.push(this._annotations.pop());
        this._canvas.queue_repaint();
    }

    _redoAnnotation() {
        if(this._redo.length) this._annotations.push(this._redo.pop());
        this._canvas.queue_repaint();
    }

    _paintAnnotations() {
        const cr=this._canvas.get_context();
        cr.setOperator(Cairo.Operator.CLEAR);
        cr.paint();
        cr.setOperator(Cairo.Operator.OVER);
        if(this._locked && this._currentRect) {
            const r=this._currentRect;
            cr.rectangle(r.x,r.y,r.width,r.height);
            cr.clip();
            const all=this._preview?[...this._annotations,this._preview]:this._annotations;
            for(const a of all) drawAnnotation(cr,a,this._snapshot.pixels,{scale:this._snapshot.scale});
        }
        cr.$dispose();
    }

    _requestCapture(rect) {
        this._locked = true;
        this._dragging = false;
        this._showRect({...rect}, true);
        this._toolbarHost.hide();
        this._hint.hide();
        this._actionHost.show();
        this._positionActionbar();
        this._updateHandles();
    }

    _finishCapture(save = false) {
        this._commitText();
        const snapshot = this._snapshot;
        const rect = {...this._currentRect};
        const annotations = JSON.parse(JSON.stringify(this._annotations));
        this._close();
        this._onCapture?.(snapshot, rect, annotations, save);
    }

    cancel() {
        this._close();
        this._onCancel?.();
    }

    _close() {
        this._releaseModal();
        this.destroy();
    }

    _releaseModal() {
        if (!this._grab)
            return;
        Main.popModal(this._grab);
        this._grab = null;
    }
});
