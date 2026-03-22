# Migration Notes: Static GNOSIS → Dynamic GNOSIS VM

## Old model

The earlier compiler effectively specialized screens into a static sequence of drawing primitives.

That model was good at:

- compile-time folding
- small draw loops
- simple MCU runtime

It was bad at:

- runtime props that affect layout
- dynamic intrinsic text
- size bubbling through containers
- reusing one program across different runtime string lengths

## New model

The new compiler emits a residual layout program.

The host still folds constants, but the output now contains:

- leaf measurement for dynamic intrinsic labels
- arithmetic over slot values
- render ops that consume final rectangles

## Semantic change

A bound label now has two explicit modes:

### Fixed field

```yaml
- type: label
  bind: sensor.temp
  field_w: 4
```

Geometry is static. Content is dynamic.

### Intrinsic runtime

```yaml
- type: label
  bind: props.title
```

Geometry is dynamic. Parent sizes and sibling positions may change at runtime.

## What to keep static

For MCU efficiency, keep these static whenever possible:

- separators
- icons
- literal labels
- numeric fields with fixed width
- bars and gauges with explicit geometry

Only use intrinsic runtime labels where layout genuinely needs to respond to content length.

## What to change in existing DSL screens

When porting existing screens:

1. convert `content:` or `label:` to `text:` for literals
2. use `bind:` for runtime text or values
3. add `field_w:` for runtime text that should not reflow layout
4. remove assumptions that all coordinates are compile-time constants

## Practical target style

A good screen usually ends up mixed:

- top-level structure static
- a few small `hbox`/`vbox` islands dynamic
- rapidly changing telemetry fields kept fixed-width

That keeps the runtime cheap without giving up dynamic layout where it matters.
