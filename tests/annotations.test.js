// SPDX-License-Identifier: Apache-2.0 OR GPL-3.0-or-later
import Cairo from 'cairo';
import GdkPixbuf from 'gi://GdkPixbuf';
import GLib from 'gi://GLib';
import {drawAnnotation} from '../extension/annotations.js';
const prefix=`${GLib.get_tmp_dir()}/qq-annotation-test-${GLib.get_monotonic_time()}`;
const original=prefix+'-original.png', output=prefix+'-output.png';
const surface=new Cairo.ImageSurface(Cairo.Format.ARGB32,200,140);
const cr=new Cairo.Context(surface);
for(let x=0;x<200;x++) {
    cr.setSourceRGB(x/200,0.6,0.8);cr.rectangle(x,0,1,140);cr.fill();
}
surface.writeToPNG(original);
const before=GdkPixbuf.Pixbuf.new_from_file(original);
const annotations=[
    {type:'rectangle',start:{x:10,y:10},end:{x:70,y:40},color:'#ff0000',width:3},
    {type:'ellipse',start:{x:10,y:50},end:{x:70,y:90},color:'#ff0000',width:3},
    {type:'arrow',start:{x:90,y:60},end:{x:150,y:60},color:'#ff0000',width:3},
    {type:'mosaic',start:{x:80,y:10},end:{x:150,y:40}},
    {type:'text',x:10,y:100,text:'中文标注',color:'#ff0000',size:22},
];
for(const a of annotations)drawAnnotation(cr,a,before);
surface.writeToPNG(output);cr.$dispose();surface.finish();
const after=GdkPixbuf.Pixbuf.new_from_file(output);
const pixel=(p,x,y)=>Array.from(p.get_pixels().slice(y*p.rowstride+x*p.n_channels,y*p.rowstride+x*p.n_channels+3));
const assert=(condition,message)=>{if(!condition)throw new Error(message);};
assert(pixel(before,190,130).join()===pixel(after,190,130).join(),'Unmarked image colors must remain unchanged');
assert(pixel(after,10,20)[0]>240 && pixel(after,10,20)[1]<20,'Rectangle was not rendered');
assert(pixel(after,40,50)[0]>240,'Ellipse was not rendered');
assert(pixel(after,120,60)[0]>240,'Arrow was not rendered');
assert(pixel(after,81,11).join()===pixel(after,88,11).join(),'Mosaic pixels must form solid blocks');
assert(pixel(after,81,11).join()!==pixel(before,81,11).join(),'Mosaic must alter the original pixels');
let red=0;
for(let y=100;y<135;y++)for(let x=10;x<110;x++) {
 const p=pixel(after,x,y);if(p[0]>220 && p[1]<50)red++;
}
assert(red>30,'Chinese text was not rendered');
GLib.unlink(original);GLib.unlink(output);
print('Inline renderer: original colors, rectangle, ellipse, arrow, mosaic and Chinese text passed');
