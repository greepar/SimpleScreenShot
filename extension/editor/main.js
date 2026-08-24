#!/usr/bin/gjs -m
// SPDX-License-Identifier: Apache-2.0 OR GPL-3.0-or-later

import GdkPixbuf from 'gi://GdkPixbuf';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk?version=4.0';

import {EditorApplication} from './application.js';
import {ScreenshotCanvas} from './canvas.js';

const extensionPath = GLib.path_get_dirname(GLib.path_get_dirname(import.meta.url.slice(7)));

if (ARGV[0] === '--self-test') {
    const inputPath = ARGV[1];
    const outputPath = ARGV[2];
    if (!inputPath || !outputPath)
        throw new Error('Usage: main.js --self-test INPUT OUTPUT');
    Gtk.init();
    const canvas = new ScreenshotCanvas();
    canvas.loadFile(inputPath);
    canvas.addText(24, 24, 'Simple ScreenShot self-test');
    canvas.addAnnotation({
        type: 'pen', color: '#ff3b30', width: 4,
        points: [{x: 40, y: 90}, {x: 110, y: 120}, {x: 180, y: 85}],
    });
    canvas.addAnnotation({
        type: 'highlighter', color: '#ffd60a', width: 5,
        points: [{x: 220, y: 90}, {x: 390, y: 90}],
    });
    canvas.addAnnotation({
        type: 'arrow', color: '#00a2ff', width: 5,
        start: {x: 460, y: 90}, end: {x: 610, y: 150},
    });
    canvas.addAnnotation({
        type: 'rectangle', color: '#34c759', width: 5,
        start: {x: 650, y: 70}, end: {x: 880, y: 170},
    });
    canvas.addAnnotation({
        type: 'mosaic', color: '#000000', width: 4,
        start: {x: 400, y: 280}, end: {x: 620, y: 410},
    });
    canvas.setPendingCrop({x: 10, y: 10, width: 930, height: 520});
    canvas.applyPendingCrop();
    canvas.exportPng(outputPath);
    const result = GdkPixbuf.Pixbuf.new_from_file(outputPath);
    if (result.width !== 930 || result.height !== 520)
        throw new Error(`Unexpected export size: ${result.width}x${result.height}`);
    console.log(`editor export test passed: ${outputPath}`);
} else {
    const inputPath = ARGV.find(argument => !argument.startsWith('-')) ?? null;
    const application = new EditorApplication(inputPath, extensionPath);
    application.run([]);
}
