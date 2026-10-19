#!/usr/bin/python3
"""Development helper: reload this installed extension using the already enabled Shell Eval API.

GJS caches modules for a session. A private revision directory lets the running
session load new source without restarting GNOME or touching other extensions.
The regular root entry is always used on the next login.
"""
from pathlib import Path
import shutil
import time
from gi.repository import Gio, GLib

root = Path.home() / '.local/share/gnome-shell/extensions/simple-screenshot@local'
revision = root / 'revisions' / f'inline-{time.time_ns()}'
revision.mkdir(parents=True)
for path in root.glob('*.js'):
    shutil.copy2(path, revision / path.name)
script = """import('resource:///org/gnome/shell/ui/main.js').then(async Main=>{
 const manager=Main.extensionManager, e=manager.lookup('simple-screenshot@local');
 const previous=e.stateObj;
 try {
  const module=await import('%s');
  await manager._callExtensionDisable(e.uuid);
  e.stateObj=new module.default({...e.metadata,dir:e.dir,path:e.path});
  await manager._callExtensionEnable(e.uuid);
  if(e.state!==1)throw new Error('Extension activation failed: '+e.error);
  global.qqInlineLoad={state:e.state,path:'%s'};
 } catch(error) {
  try {
   e.stateObj=previous;
   manager._changeExtensionState(e,2);
   await manager._callExtensionEnable(e.uuid);
  }catch(_){}
  global.qqInlineLoad={error:error.stack};
 }
});""" % ((revision / 'extension.js').as_uri(), revision)
bus = Gio.bus_get_sync(Gio.BusType.SESSION, None)
result = bus.call_sync('org.gnome.Shell', '/org/gnome/Shell', 'org.gnome.Shell', 'Eval',
    GLib.Variant('(s)', (script,)), None, Gio.DBusCallFlags.NONE, 10000, None).unpack()
if not result[0]:
    raise SystemExit(f'Shell Eval unavailable: {result[1]}')
print('Requested activation. Read global.qqInlineLoad via Shell Eval for the result.')
