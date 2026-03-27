import type { Meta, StoryObj } from '@storybook/react';
import { SlotGrid } from './SlotGrid';
import '../../../styles/explorer.css';

const meta: Meta<typeof SlotGrid> = {
  title: 'Explorer/2 — Slots and the Node Grid',
  component: SlotGrid,
  parameters: {
    layout: 'fullscreen',
    backgrounds: { default: 'terminal' },
  },
};

export default meta;
type Story = StoryObj<typeof SlotGrid>;

/** Full article screen with prose + embedded widget */
export const Article: Story = {
  render: () => (
    <div data-part="explorer-article">
      <h1>HOW THE GNOSIS DYNAMIC VM WORKS</h1>

      <h2>2. SLOTS: THE LAYOUT MEMORY</h2>

      <p>
        Each node in the layout tree has <strong>6 slots</strong> — named
        storage locations that hold the node's geometry:
      </p>

      <p>
        <code>mw</code> and <code>mh</code> are the <strong>measured</strong> width
        and height (computed from content). <code>x</code> and <code>y</code> are
        the position. <code>w</code> and <code>h</code> are the <strong>final</strong> width
        and height used for rendering.
      </p>

      <p>
        The slot address formula is simple: <code>node_index × 6 + field_offset</code>.
        So <code>n0.mw</code> is slot 0, <code>n0.mh</code> is slot 1, ..., <code>n1.mw</code> is slot 6.
      </p>

      <p>
        Try it: <strong>change the title text</strong> below and watch how the
        measured width (<code>mw</code>) changes. Each character is 8 pixels wide,
        multiplied by the font size.
      </p>

      <div data-part="explorer-widget-slots">
        <SlotGrid />
      </div>

      <p>
        Notice that <code>MEASURE_TEXT_BIND</code> writes directly to the
        <code>mw</code> and <code>mh</code> slots — it doesn't use the stack.
        Then <code>PUSH_SLOT</code> copies the measured width onto the stack,
        and <code>STORE_SLOT</code> pops it into the final <code>w</code> slot.
      </p>

      <p>
        This two-step dance (measure → copy) exists because sometimes the
        compiler needs to do arithmetic between the measure and the store —
        for example, subtracting padding or computing a child's offset
        relative to its parent.
      </p>

      <p>
        Try changing the font size from 2 to 3. The measured width doubles
        because each glyph is now 24px (8×3) instead of 16px (8×2).
      </p>
    </div>
  ),
};

/** Widget only */
export const WidgetOnly: Story = {};

/** Short text */
export const ShortText: Story = {
  args: { title: 'HI', fontSize: 1, nodeX: 0, nodeY: 0 },
};

/** Long text, large size */
export const LargeText: Story = {
  args: { title: 'REACTOR-7 CRITICAL', fontSize: 3, nodeX: 16, nodeY: 32 },
};
