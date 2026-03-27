import type { Meta, StoryObj } from '@storybook/react';
import { LayoutBuilder } from './LayoutBuilder';
import '../../../styles/explorer.css';

const meta: Meta<typeof LayoutBuilder> = {
  title: 'Explorer/7 — Building a Layout',
  component: LayoutBuilder,
  parameters: {
    layout: 'fullscreen',
    backgrounds: { default: 'terminal' },
  },
};

export default meta;
type Story = StoryObj<typeof LayoutBuilder>;

export const Article: Story = {
  render: () => (
    <div data-part="explorer-article">
      <h1>HOW THE GNOSIS DYNAMIC VM WORKS</h1>

      <h2>7. BUILDING A LAYOUT FROM SCRATCH</h2>

      <p>
        Now that you understand the stack, slots, drawing, phases, binary
        format, and runtime binding — let's put it all together. Build a
        layout by <strong>adding elements</strong> and watch the compiler
        emit bytecode in real time.
      </p>

      <p>
        Click the palette buttons to add a <strong>Label</strong>,
        <strong> Bar</strong>, or <strong>HLine</strong> to the canvas. Select
        an element and edit its properties — the YAML source and bytecode
        listing update live.
      </p>

      <div data-part="explorer-widget-builder">
        <LayoutBuilder />
      </div>

      <p>
        This is the <strong>full development cycle</strong> in miniature:
        visual element {'\u2192'} YAML description {'\u2192'} bytecode instructions.
        In the real workbench, the YAML is compiled by the Python backend into
        the binary GNDY format. Here, we show a simplified instruction listing
        to illustrate the correspondence.
      </p>

      <p>
        Try adding multiple labels and a bar. Notice how each element
        produces a corresponding <code>DRAW_*</code> instruction. The total
        bytecode size grows linearly — each label adds 7 bytes, each bar
        adds 9 bytes, each hline adds 4 bytes, plus 1 byte for HALT.
      </p>

      <p>
        This is the end of the tour. You now understand:
      </p>

      <p>
        <strong>1.</strong> The <strong>stack</strong> is a scratchpad for arithmetic.{' '}
        <strong>2.</strong> <strong>Slots</strong> hold layout geometry.{' '}
        <strong>3.</strong> <strong>DRAW</strong> instructions read slots to render pixels.{' '}
        <strong>4.</strong> Execution flows through <strong>measure → compute → render</strong>.{' '}
        <strong>5.</strong> The <strong>binary format</strong> is compact and self-contained.{' '}
        <strong>6.</strong> The same bytecode adapts to different <strong>runtime data</strong>.{' '}
        <strong>7.</strong> Visual layouts compile to <strong>sequential instructions</strong>.
      </p>
    </div>
  ),
};

export const WidgetOnly: Story = {};
