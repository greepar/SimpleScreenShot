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
