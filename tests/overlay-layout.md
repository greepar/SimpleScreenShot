# Selection shade regression check

Run on GNOME Shell 46 after loading the changed extension.

1. Open a window away from the top edge of the screen.
2. Open the capture overlay and select window mode.
3. Hover over that window immediately, before hovering over a full-screen window.
4. Confirm that the area above the selection is shaded from the top edge, and
   that no horizontal shade crosses the selected window.
5. Move between windows of different heights and repeat with a dragged region.
6. Cancel and reopen the overlay, then repeat to cover newly created shade actors.

Before the fix, a newly created top shade could remain without a fixed position
when positioned at its initial `(0, 0)`, allowing BinLayout to center it vertically.

## Pointer and popup capture

1. Put the pointer over the intended capture area and open the overlay by shortcut.
2. Toggle the toolbar's pointer switch on and off. The preview should show or hide
   the pointer at its original location, without following the selection cursor.
3. Capture with the switch on, then off, and compare the exported images.
4. Reopen the overlay and preferences; both should retain the last switch value.
5. Press Super to open the Zorin start menu, then use the capture shortcut.
   The frozen screenshot should contain the expanded menu, while the live menu
   closes so the selection overlay can receive clicks and Escape.
6. Repeat with a panel popup and GNOME overview, then cancel the capture and
   confirm normal keyboard and pointer interaction resumes.
