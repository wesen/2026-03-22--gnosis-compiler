import type { Meta, StoryObj } from '@storybook/react';
import { CanvasPreview } from './CanvasPreview';
import '../../../styles/explorer.css';

const meta: Meta<typeof CanvasPreview> = {
  title: 'Explorer/3 — From Slots to Pixels',
  component: CanvasPreview,
  parameters: {
    layout: 'fullscreen',
    backgrounds: { default: 'terminal' },
  },
};

export default meta;
type Story = StoryObj<typeof CanvasPreview>;

export const Article: Story = {
  render: () => (
    <div data-part="explorer-article">
      <h1>HOW THE GNOSIS DYNAMIC VM WORKS</h1>

      <h2>3. FROM SLOTS TO PIXELS</h2>

      <p>
        Draw instructions read <code>x</code>, <code>y</code>, <code>w</code>,
        and <code>h</code> from the node's slots and render to the canvas at
        those coordinates. The text is rendered using a bitmap font where each
        character is <strong>8px wide</strong> (GLYPH_W) and <strong>8px
        tall</strong> (GLYPH_H), scaled by the font size.
      </p>

      <p>
        <strong>Drag the sliders</strong> below to move the text on the canvas.
        The dashed bounding box shows exactly where the VM places the element.
        Change the text or font size and watch the bounding box resize.
      </p>

      <div data-part="explorer-widget-canvas">
        <CanvasPreview />
      </div>

      <p>
        The canvas is <strong>280×120 pixels</strong>, matching a typical e-ink
        display module. All coordinates are in pixel units with no
        sub-pixel addressing — the VM works in integer math only.
      </p>

      <p>
        The <strong>color palette</strong> has 5 entries: background (0),
        foreground (1), mid (2), light (3), and ghost (4). These map to
        grayscale levels that render well on e-ink. The color index is baked
        into the bytecode — each <code>DRAW_TEXT</code> instruction carries a
        1-byte color field.
      </p>

      <p>
        Notice that changing <code>w</code> via the slider doesn't change the
        rendered text width — the text still occupies <code>len × glyph_w × size</code> pixels.
        But the bounding box changes, which matters for layout: parent containers
        use <code>w</code> and <code>h</code> to compute child positions.
      </p>
    </div>
  ),
};

export const WidgetOnly: Story = {};

export const LargeFont: Story = {
  args: { initialText: 'BIG', initialSize: 3, initialColor: 2 },
};

export const SingleChar: Story = {
  args: { initialText: '%', initialSize: 1, initialColor: 3 },
};
