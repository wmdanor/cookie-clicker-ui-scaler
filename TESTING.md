# UI Scaler Test Checklist

Run the quick regression pass for every code change. Run the extended pass
before publishing a Workshop release or when investigating a related report.

### Quick regression test

#### Q-01: Initial load

Scales: saved scale, then 100%.

- [ ] Start Cookie Clicker with UI Scaler enabled.
- [ ] Confirm the saved scale is applied without a visible script error.
- [ ] Open Options and confirm the UI Scaler controls appear once, use Cookie
      Clicker's normal visual style, and show the current scale.

Pass condition: the game loads normally, the scale is correct, and the options
controls are neither missing nor duplicated.

#### Q-02: Scale controls

Scales: 50%, 100%, 150%, and 300%.

- [ ] Move the slider to each scale.
- [ ] Use the minus and plus buttons.
- [ ] Use `Ctrl+-`, `Ctrl++`, and `Ctrl+0`.
- [ ] Confirm the displayed percentage follows every change.
- [ ] Confirm values remain within the configured minimum and maximum.

Pass condition: every control changes the same setting in the configured step,
and `Ctrl+0` restores 100%.

#### Q-03: Reset without reload

Scales: 150% to 100%, then 50% to 100%.

- [ ] At the non-default scale, open and close a tooltip and a prompt.
- [ ] Reset to 100% without restarting or reloading the mod.
- [ ] Repeat the same tooltip and prompt interactions.

Pass condition: positions immediately match normal Cookie Clicker behavior at
100%; no previous correction remains applied.

#### Q-04: Local persistence

Scales: 150% or another non-default value.

- [ ] Select a scale and fully restart Cookie Clicker.
- [ ] Confirm that scale is restored.
- [ ] Change save slots or import another save and confirm the scale does not
      change with the game save.

Pass condition: the scale persists on the current computer through local
storage but is not stored in or controlled by a Cookie Clicker save.

#### Q-05: Store building tooltips

Scales: 50%, 100%, 150%, and 300%.

- [ ] Hover a building near the top of the store, such as Cursor.
- [ ] Hover a building near the bottom of the visible store.
- [ ] Scroll the store and hover another building.

Pass condition: every tooltip is visible, horizontally attached to the store,
and vertically close to the hovered building without being clipped off-screen.

#### Q-06: Mouse-positioned and crate tooltips

Scales: 50%, 100%, 150%, and 300%.

- [ ] Hover the milk icon in Stats.
- [ ] Hover an achievement near the center of the achievement grid.
- [ ] Hover achievements near the left, right, top, and bottom edges of the
      visible grid.
- [ ] Hover unlocked and locked upgrade crates when available.
- [ ] Hover Heralds and an ascension fork when available.

Pass condition: each tooltip points to or appears close to its source, remains
inside the viewport, and does not jump to a different vertical position.

#### Q-07: Standard prompt position

Scales: 50%, 100%, 150%, and 300%.

- [ ] Open the Ascend confirmation, but cancel it without changing the save.
- [ ] Open another standard confirmation prompt if one is safely available.
- [ ] Resize the window and repeat.

Pass condition: the prompt is visually centered in the usable game area and
remains fully accessible. Its dark overlay covers the intended area.

#### Q-08: Big-cookie click effects

Scales: 50%, 100%, 150%, and 300%.

- [ ] Enable particles and numbers in Options.
- [ ] Click the center of the big cookie several times.
- [ ] Click several visibly different points around its edge.

Pass condition: cookie particles originate at the pointer and the `+cookies`
number starts just above it with only Cookie Clicker's small random offset.

#### Q-09: Mouse-positioned popup and sparkle

Scales: 50%, 100%, 150%, and 300%.

- [ ] Click a golden cookie or another shimmer when available.
- [ ] Cast a Grimoire spell that produces result text.
- [ ] Trigger another safe mouse-positioned popup when available.

Pass condition: the sparkle and result text appear at the clicked control or
pointer, remain visible near viewport edges, and do not move by the scale
multiplier.

#### Q-10: Repeated scale changes

Scales: cycle 100% -> 150% -> 50% -> 300% -> 100% at least three times.

- [ ] Repeat one store tooltip check after every cycle.
- [ ] Repeat one big-cookie effect check after every cycle.
- [ ] Open a prompt after the final reset.

Pass condition: corrections are not applied multiple times, no event handler is
duplicated, and the final 100% positions match the initial 100% positions.

#### Q-11: Grandma and You canvas hover behavior

Scales: 50%, 100%, 150%, and 300%.

- [ ] Move the pointer slowly across the Grandma building canvas and confirm
      each name label points to the visible grandma under the pointer.
- [ ] Repeat on the You building canvas when unlocked.

Pass condition: hover feedback matches the visible canvas object under the
pointer at every scale.

#### Q-12: Wrinkler hit testing

Scales: 50%, 100%, 150%, and 300%.

- [ ] Hover the center and edge of several wrinklers.
- [ ] Move the pointer just outside them and confirm the hover ends.
- [ ] Pop a wrinkler and observe its popup and particles.

Pass condition: the hover/click area matches the visible wrinkler and its
effects originate from the expected position.

### Extended compatibility test

These cases cover code paths identified as potentially sensitive to CSS zoom.
A failure confirms the area needs a targeted correction; it does not mean a
correction should be applied to unrelated coordinate paths.

#### E-01: Ascension map center and drag

Scales: 50%, 100%, 150%, and 300%.

- [ ] Enter the ascension screen using a backed-up test save.
- [ ] Confirm the heavenly-upgrade tree begins visually centered.
- [ ] Drag horizontally and vertically from several points.
- [ ] Change ascension zoom level, then drag again.

Pass condition: the map starts centered, remains under the pointer while
dragging, does not jump on mouse-down, and moves the same perceived distance as
the pointer.

#### E-03: Santa and dragon interaction

Scales: 50%, 100%, 150%, and 300%.

- [ ] Open the Santa interface and interact with its visible controls.
- [ ] Open the dragon interface and hover/click its visible controls.
- [ ] Pet the dragon and observe the particle effect.

Pass condition: hit targets match their images, the intended control reacts,
and the dragon particle retains its intentional offset above the pointer.

#### E-04: Pantheon dragging

Scales: 50%, 100%, 150%, and 300%.

- [ ] Pick up a spirit from a slot.
- [ ] Drag it slowly across each slot and outside the Pantheon.
- [ ] Return it safely without consuming an unintended swap.

Pass condition: the dragged spirit follows the pointer and only the visibly
hovered slot is selected as the drop target.

#### E-05: Garden cursor and planting

Scales: 50%, 100%, 150%, and 300%.

- [ ] Select a seed and move across all four corners and the center of the plot.
- [ ] Confirm the seed cursor follows the pointer.
- [ ] Plant in several known tiles on a disposable test state.
- [ ] Harvest a plant that produces a mouse-positioned popup or sparkle.

Pass condition: the visible cursor, hovered tile, planted tile, popup, and
sparkle all correspond to the pointer position.

#### E-06: Tooltip boundary branches

Scales: 50%, 150%, and 300%.

- [ ] Make the game window narrow and hover tooltips at every viewport edge.
- [ ] Repeat with a short and wide window.
- [ ] Test both short and unusually tall tooltip content when available.

Pass condition: tooltips remain visible and close to their source without
incorrectly flipping, clipping, or crossing the viewport.

#### E-07: Responsive layout and ticker

Scales: 50%, 100%, 150%, and 300%.

- [ ] Resize the window slowly across the ticker's narrow-layout threshold.
- [ ] Check the top bar, ticker, left section, center section, and store.
- [ ] Toggle fullscreen and return to windowed mode.

Pass condition: sections do not overlap or leave inaccessible controls, and the
ticker selects a layout appropriate for the visible space.

#### E-08: Stock Market graph

Scales: 50%, 100%, 150%, and 300%.

- [ ] Move the pointer along the graph edges and across several data points.
- [ ] Compare the visible pointer location with any highlighted point or
      displayed value.
- [ ] Exercise safe graph controls if available.

Pass condition: graph hover feedback and values correspond to the point under
the pointer.
