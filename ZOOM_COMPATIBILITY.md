# CSS Zoom Compatibility Notes

This document tracks the work UI Scaler needs in addition to setting
`document.body.style.zoom`. It describes the behavior of Cookie Clicker 2.053,
the compatibility fixes currently implemented by the mod, and areas that may
still be affected but have not been confirmed in normal play.

## Why setting `zoom` is not enough

CSS zoom changes the size and coordinate system used to render the document.
Cookie Clicker, however, calculates positions from a mixture of values:

- `Game.mouseX` and `Game.mouseY`, derived from mouse events
- `Game.windowW` and `Game.windowH`, derived from the viewport
- DOM element bounds returned by `getBoundingClientRect()`/`getBounds()`
- coordinates inside the game's canvases
- CSS positions assigned directly to zoomed elements

These values do not all react to `body.style.zoom` in the same way. A viewport
coordinate may therefore be used as though it were a logical CSS coordinate,
moving an element too far by the zoom multiplier.

Cookie Clicker's `Game.scale` handling does not solve this. It is the game's
own browser/device scaling mechanism and does not include the additional CSS
zoom applied by UI Scaler.

A global coordinate conversion would also be unsafe. Some positions already
come from a local canvas or element coordinate system, and converting those a
second time would break behavior that currently works. Corrections must be
limited to call paths whose coordinate source is known.

## Implemented compatibility work

The following fixes are present in the current working tree.

### Layout refresh after changing scale

After applying the new CSS zoom, UI Scaler dispatches a resize event on the
next animation frame. This lets Cookie Clicker recalculate its normal layout
after the browser has applied the style change.

This is necessary for layout refreshes, but it does not convert coordinates:
`window.innerWidth` and `window.innerHeight` still describe the viewport rather
than the logical size of the zoomed body.

### Tooltips

UI Scaler wraps `Game.tooltip.update` and temporarily presents logical values
for `Game.mouseX`, `Game.mouseY`, `Game.windowW`, and `Game.windowH` while a
mouse-positioned tooltip is laid out. Store tooltips also need the logical
viewport width because Cookie Clicker anchors them against the right side of
the window.

This fixes the confirmed displaced or missing tooltips for store buildings and
other mouse-positioned tooltip paths.

Element/crate tooltips are deliberately not converted in the same way. Their
positions originate from element bounds rather than directly from the mouse,
and achievement and upgrade tooltips have been observed working without that
conversion.

### Standard prompts

Cookie Clicker centers prompts in `Game.UpdatePrompt` using `Game.windowH` and
then assigns that result as a CSS position inside the zoomed body. UI Scaler
corrects the resulting vertical position.

This fixes the confirmed displaced Ascend confirmation and also applies to
other prompts that use Cookie Clicker's standard prompt system.

### Mouse-anchored text, particles, and sparkles

UI Scaler wraps these Cookie Clicker functions:

- `Game.Popup`
- `Game.SparkleAt`
- `Game.particleAdd`

Coordinates known to originate from `Game.mouseX`/`Game.mouseY` are converted
to the body's logical coordinate space. Intentional local offsets are retained
for the `+cookies` number and dragon pet particles.

`Game.Popup` additionally clamps explicit positions against `Game.bounds`.
Those bounds are temporarily converted for the synchronous popup call and the
original object is restored immediately afterwards.

This fixes the confirmed displacement of click particles, `+cookies` text,
mouse-positioned sparkles, and Grimoire spell-result text. Effects positioned
from an element, a canvas object, or another explicit game coordinate are left
unchanged.

### Garden selected-seed cursor

The Garden calculates its selected-seed transform from viewport mouse
coordinates and the already-logical bounds of its drag layer, then applies that
transform inside the zoomed body. UI Scaler wraps the Garden's draw method and
temporarily converts only the mouse coordinates while retaining the Garden's
element bounds and local cursor offsets. This avoids drawing an incorrect
position and correcting it afterward.

This fixes the confirmed seed cursor displacement without changing tile hit
testing or planting behavior.

### Pantheon dragging

The Pantheon uses the same mixture of viewport coordinates and a transform in
the zoomed body while a spirit is dragged. UI Scaler wraps the Pantheon's draw
method and temporarily converts its mouse coordinates. Slot snapping uses two
element bounds from the same coordinate space and remains unchanged because it
does not use the temporarily converted mouse values.

This fixes the confirmed dragged-spirit displacement while leaving the
Pantheon's existing mouseover-based slot selection and drop behavior intact.

### Stock Market graph interaction

The Stock Market compares browser `layerX`/`layerY` values with coordinates in
its canvas bitmap. UI Scaler repeats the graph-line hit test with logical layer
coordinates after Cookie Clicker's existing listener runs, then updates the
same hover state and tooltip.

This fixes the confirmed missing graph-line tooltips and keeps the correction
limited to the Stock Market canvas.

### Grandma and You building-canvas hover checks

Cookie Clicker records the pointer's distance from a building canvas by mixing
page coordinates with element bounds, then compares that value with sprite
positions in the canvas's logical coordinate space. UI Scaler adds a later
mouse listener only to the Grandma and You canvases. It replaces the mixed
coordinate with the event's canvas-local position converted for CSS zoom.

This fixes Grandma name and age labels selecting a character far from the
pointer. The same correction covers the equivalent hover path in the You
building canvas.

### Wrinkler mouse hit testing

Wrinklers are positioned and drawn in the left canvas's logical coordinate
space, but Cookie Clicker tests them against the viewport-oriented
`Game.mouseX`/`Game.mouseY`. UI Scaler wraps `Game.UpdateWrinklers` and
temporarily converts only those global mouse coordinates for the synchronous
update.

This fixes wrinklers highlighting and popping at a position offset from their
visible bodies. Mouse-anchored popup and particle corrections recognize the
temporary logical-coordinate context so they are not converted twice.

## Observed working without another fix

These paths have been checked in practice and should not be treated as known
bugs:

- Achievement crate tooltips
- Upgrade crate tooltips
- Herald and ascension-fork tooltips

They should still be retested at multiple scales because edge clamping or a
different screen layout may exercise another positioning branch.

## Potentially affected areas

The following areas use coordinate calculations that look sensitive to CSS
zoom in Cookie Clicker 2.053. They are not confirmed bugs yet and are not fixed
by UI Scaler unless stated otherwise above.

### High likelihood

#### Ascension map centering and dragging

The ascension map centers itself using `Game.windowW`/`Game.windowH` and tracks
dragging with `Game.mouseX`/`Game.mouseY`. The viewport, CSS layout, and map
transform may therefore disagree under CSS zoom.

Possible symptoms include an off-center heavenly-upgrade tree, incorrect drag
speed, or the map jumping when dragging begins.

#### Santa and dragon special-tab hit testing

The Santa and dragon interfaces calculate icon locations and compare them with
the global mouse coordinates. Those calculations may not share the same scale
after CSS zoom.

Possible symptoms include an offset clickable area or the wrong item reacting
to the pointer.

### Medium likelihood

#### Element-anchored tooltip clamping

Cookie Clicker's tooltip code has several branches based on element bounds,
tooltip origin, viewport size, and available space near an edge. The currently
working achievement and upgrade cases do not prove every branch is safe.

Possible symptoms include otherwise correct tooltips becoming displaced only
near a window edge, at a particular scale, or with an unusually tall tooltip.

#### Responsive ticker and layout thresholds

Cookie Clicker uses `Game.windowW` for responsive decisions such as the narrow
ticker layout. Dispatching a resize recalculates the value, but CSS zoom does
not necessarily change the viewport width it represents.

Possible symptoms include Cookie Clicker selecting a layout intended for a
different effective width, even though individual elements are scaled.

### Lower likelihood or limited impact

#### Debug tools and ascension editor

Cookie Clicker's debug toys and ascension-tree editor contain direct mouse and
canvas calculations. They are not part of normal gameplay, but may be offset
when used with CSS zoom.

#### Other mods

Another mod may position UI from `Game.mouseX`, `Game.windowW`, DOM bounds, or
canvas coordinates and encounter the same mismatch. It may also replace one of
the functions wrapped by UI Scaler after UI Scaler initializes, bypassing the
correction.

Compatibility therefore depends on mod load order and on whether the other mod
uses Cookie Clicker's functions or its own positioning code.

## Assumptions behind the current fixes

- The behavior and function signatures match Cookie Clicker 2.053.
- `Game.mouseX`/`Game.mouseY` are viewport-oriented values when passed directly
  to the affected positioning functions.
- `Game.tooltip.update`, `Game.UpdatePrompt`, `Game.Popup`, `Game.SparkleAt`, and
  `Game.particleAdd` complete their relevant positioning work synchronously.
- The Garden and Pantheon draw methods complete synchronously and use the global
  mouse coordinates only for their dragged visuals in Cookie Clicker 2.053.
- The Garden and Pantheon element bounds are already in the coordinate space
  used by transforms inside the zoomed body; only their mouse coordinates need
  conversion.
- The Stock Market's `layerX`/`layerY` values carry the CSS zoom multiplier
  while the graph data is represented in logical canvas coordinates.
- The Grandma and You building-canvas `layerX`/`layerY` values carry the CSS
  zoom multiplier, while their sprite positions remain in logical canvas
  coordinates.
- `Game.UpdateWrinklers` completes synchronously, and its wrinkler positions
  use the same logical coordinate space as the left canvas.
- Cookie Clicker's small randomized click-number offset and fixed dragon-pet
  offset remain the same as in 2.053.
- Temporarily replacing global coordinate values is safe because each original
  function is called and the values are restored before control returns.

These are internal Cookie Clicker APIs rather than a documented mod hook for
CSS scaling. A future game update may require the assumptions to be reviewed.
