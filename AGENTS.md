# Repository Instructions

## Project overview

UI Scaler is a lightweight Steam mod for Cookie Clicker 2.053. It changes the
game UI scale with `document.body.style.zoom` and adds controls to Cookie
Clicker's Options menu. It has no build step and no CCSE dependency.

Keep changes small and specific to the requested behavior. Do not introduce a
framework, bundler, package manager, or unrelated refactor.

## Repository layout

- `mod/main.js`: mod class, Cookie Clicker hooks, controls, persistence, and
  targeted zoom compatibility corrections
- `mod/options.html`: simple Options-menu template loaded and populated by the
  mod
- `mod/info.txt`: Steam/Cookie Clicker mod metadata
- `mod/thumbnail.png`: Steam Workshop thumbnail
- `README.md`: user-facing overview, installation, and local development
- `ZOOM_COMPATIBILITY.md`: implemented coordinate fixes, assumptions, and
  suspected compatibility areas
- `TESTING.md`: quick and extended manual verification checklists
- `workshop-description.bbcode`: Workshop-ready description

Only files under `mod/` belong in the installed or uploaded Cookie Clicker mod
folder. Development documentation stays at the repository root.

## Required behavior

Preserve these project decisions unless the user explicitly changes them:

- Register with `Game.registerMod('UI_Scaler', ...)`.
- Display the name `UI Scaler`.
- Default to 100% scale.
- Support 50% through 300% in 25-point steps.
- Apply scale through `document.body.style.zoom`.
- Provide Options-menu slider, decrease, increase, and reset controls.
- Support `Ctrl++`, `Ctrl+-`, and `Ctrl+0` without firing while the user is
  typing in an editable control.
- Store the scale in local storage under `UI_Scaler.scale`.
- Keep scale machine-local; it must not migrate through Cookie Clicker saves or
  Steam Cloud. `save()` returns an empty string and `load()` is intentionally a
  no-op.
- Keep Cookie Clicker 2.053 compatibility.
- Keep Steam achievements enabled with `AllowSteamAchievs: 1`.
- Do not add CCSE or another runtime dependency.

## JavaScript style

- Keep the implementation wrapped in the `UIScaler` class.
- Modern JavaScript supported by Cookie Clicker 2.053's Electron runtime is
  acceptable. There is no requirement to rewrite code into legacy `var` and
  prototype syntax.
- Add useful JSDoc types to fields, parameters, return values, callbacks, and
  Cookie Clicker objects whose shape is not obvious.
- Keep event handlers as named class methods and bind them in the handler map.
- Keep setup methods readable and narrowly focused.
- Follow the existing tab indentation and brace style in `mod/main.js`.
- Prefer clear names and early returns over deeply nested branches.
- Do not add compatibility parsing or data migration without a real published
  format that requires it.

## Options UI

- Keep `mod/options.html` as a simple template.
- Populate template placeholders in JavaScript rather than constructing a large
  HTML string in `main.js`.
- Reuse Cookie Clicker's classes and visual conventions.
- Cookie Clicker rebuilds its menu, so the draw hook may recreate the controls.
  Guard against duplicate elements and duplicate event listeners.
- Preserve the current layout: decrease button, slider, increase button on the
  first row, with a separate reset control below.

## CSS zoom and coordinates

Read `ZOOM_COMPATIBILITY.md` before changing any positioning correction.

CSS zoom creates several coordinate spaces: viewport mouse coordinates,
viewport dimensions, DOM bounds, logical CSS positions, and canvas-local
coordinates. They cannot safely be converted with one global rule.

When working on a confirmed positioning issue:

- Identify where the coordinates originate and where they are rendered.
- Correct only the affected Cookie Clicker call path.
- Do not divide all mouse, bounds, canvas, or viewport values globally.
- Preserve deliberate local offsets.
- Make the 100% path equivalent to unmodified Cookie Clicker behavior.
- When temporarily replacing a `Game` global, restore the exact original value
  in `finally` before returning or throwing.
- Preserve the original function context, arguments, and return value.
- Guard wrapper installation so repeated initialization cannot stack the same
  correction.
- Consider interactions with other mods that may wrap the same function.

Do not implement items listed only as potentially affected in
`ZOOM_COMPATIBILITY.md` unless the user asks for that fix or the behavior has
been confirmed and placed in scope.

## Cookie Clicker API assumptions

The mod relies on globals supplied by Cookie Clicker, including `Game`, `l`,
`PlaySound`, and the mod instance's injected `dir` property.

Important assumptions:

- Cookie Clicker calls `init()` after registration.
- The Options menu is rebuilt dynamically and can be extended from a draw hook.
- Local template requests may return HTTP status `0` in Electron, which is a
  valid successful local-file response when content is present.
- The positioning functions currently wrapped by the mod complete their
  relevant work synchronously.
- `Game.mouseX`/`Game.mouseY`, `Game.windowW`/`Game.windowH`, element bounds,
  and canvas positions must be treated as distinct coordinate sources.

If a game update changes one of these assumptions, document the change and
verify it against the actual game source before adapting the mod.

## Verification

Always inspect existing changes before editing and preserve unrelated user
work. At minimum, run:

```sh
node --check mod/main.js
git diff --check
```

For coordinate wrappers, add or run a focused JavaScript mock that verifies:

- the affected coordinates at a non-default scale;
- unchanged unrelated coordinate paths;
- unchanged behavior at 100%;
- restoration of temporarily replaced globals, including when the wrapped
  callback throws;
- protection against installing the same wrapper twice.

Use `TESTING.md` for in-game verification. The quick pass is expected for every
behavioral update; use the extended cases for progression-dependent or
suspected paths. Manual testing should include both scale directions and the
extremes: 50%, 100%, 150%, and 300%.

There is currently no package-based automated test suite. Do not claim visual
in-game verification when only syntax or mocks were run.

## Scope and publishing

- Avoid unrelated formatting, renaming, or cleanup.
- Do not change the mod ID, storage key, save behavior, Workshop metadata,
  thumbnail, license, or compatibility target unless requested.
- Do not commit, push, publish to Steam Workshop, or modify the local Steam
  installation unless explicitly asked.
- When publishing is requested, distinguish repository-only documentation from
  files that belong in the `mod/` upload directory.
- Report Cookie Clicker API assumptions and the exact verification performed in
  the handoff.
