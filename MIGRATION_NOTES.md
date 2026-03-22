# Migration Notes

## Old shape

The previous prototype bundled these into one React-oriented artifact:

- the source DSL
- compile-time optimization logic
- bytecode encoding
- bytecode execution
- a visual debugger
- sample screens

That is useful as a demo, but brittle as a compiler.

## New shape

The rebuild treats the compiler as its own product.

- source handling is isolated in `dsl.py`
- optimization passes live in `passes.py`
- layout is isolated in `layout.py`
- bytecode lowering is isolated in `lower.py`
- binary serialization is isolated in `serialize.py`

## Practical migration advice

1. Keep your current UI only as a viewer / debugger.
2. Move compilation out of the UI process.
3. Treat the normalized AST and laid-out AST as explicit debug artifacts.
4. Make the MCU runtime consume `GNBC`, not the source DSL.
5. Only add new widgets after deciding how they lower into the bytecode vocabulary.
