import type { Meta, StoryObj } from '@storybook/react';
import { Pipeline } from './Pipeline';
import '../../../styles/explorer.css';

const meta: Meta<typeof Pipeline> = {
  title: 'Explorer/4 — The Full Pipeline',
  component: Pipeline,
  parameters: {
    layout: 'fullscreen',
    backgrounds: { default: 'terminal' },
  },
};

export default meta;
type Story = StoryObj<typeof Pipeline>;

export const Article: Story = {
  render: () => (
    <div data-part="explorer-article">
      <h1>HOW THE GNOSIS DYNAMIC VM WORKS</h1>

      <h2>4. THE FULL PIPELINE</h2>

      <p>
        Execution has <strong>three phases</strong>. First, <code>MEASURE</code> instructions
        read runtime data and compute content dimensions. Then, <code>COMPUTE</code> instructions
        do arithmetic to calculate final positions and sizes. Finally, <code>RENDER</code> instructions
        read the computed slots and emit draw operations to the canvas.
      </p>

      <p>
        Click the phase buttons below to see what happens in each phase. The
        left column shows the instructions, the middle column shows which
        slots change, and the right column shows the canvas state at the
        end of that phase.
      </p>

      <div data-part="explorer-widget-pipeline">
        <Pipeline />
      </div>

      <p>
        This separation into phases is not enforced by the VM — it's a
        <strong>convention of the compiler</strong>. The VM just executes
        instructions sequentially. But the compiler always emits them in
        this order: measures first, then arithmetic, then draws. This makes
        the execution predictable and debuggable.
      </p>

      <p>
        Try changing the temperature slider. Notice that only the RENDER
        phase output changes — the MEASURE and COMPUTE phases are unaffected
        because temperature doesn't influence the layout. The bar fill
        width is computed at render time: <code>trunc(w × value / max)</code>.
      </p>

      <p>
        Now change the title text. This time, the MEASURE phase also changes
        because the title length affects the measured width. The COMPUTE phase
        propagates this change to the final w/h slots. Everything cascades.
      </p>
    </div>
  ),
};

export const WidgetOnly: Story = {};

export const HighTemp: Story = {
  args: { initialTitle: 'REACTOR-7', initialTemp: 95 },
};
