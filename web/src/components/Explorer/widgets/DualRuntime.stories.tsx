import type { Meta, StoryObj } from '@storybook/react';
import { DualRuntime } from './DualRuntime';
import '../../../styles/explorer.css';

const meta: Meta<typeof DualRuntime> = {
  title: 'Explorer/6 — Runtime Binding',
  component: DualRuntime,
  parameters: {
    layout: 'fullscreen',
    backgrounds: { default: 'terminal' },
  },
};

export default meta;
type Story = StoryObj<typeof DualRuntime>;

export const Article: Story = {
  render: () => (
    <div data-part="explorer-article">
      <h1>HOW THE GNOSIS DYNAMIC VM WORKS</h1>

      <h2>6. RUNTIME BINDING</h2>

      <p>
        The same compiled program adapts to <strong>different data at
        runtime</strong>. The bytecode never changes — only the runtime
        values do. This is the "dynamic" in GNOSIS Dynamic VM.
      </p>

      <p>
        Below are two runtime panels with the <strong>same bytecode</strong>.
        Drag the temperature slider on one side and watch only that canvas
        update. Change a title and see how the layout shifts — the measured
        width changes because the text is different, but the instructions
        are identical.
      </p>

      <div data-part="explorer-widget-dual">
        <DualRuntime />
      </div>

      <p>
        Click <strong>"show diff"</strong> to see which slots differ between
        the two evaluations. The diff reveals what's <strong>layout-dependent
        </strong> (title width, bar fills) versus what's <strong>fixed</strong>
        (positions, separator widths).
      </p>

      <p>
        This architecture means the compiler runs <strong>once</strong>, and
        the resulting bytecode can be re-evaluated thousands of times with
        different sensor readings, user preferences, or API responses.
        On an e-ink device refreshing every 30 seconds, the CPU cost is
        just the VM evaluation — no parsing, no layout tree walks.
      </p>

      <p>
        Try the <strong>SWAP</strong> button to exchange the two datasets.
        The canvases switch but the bytecode stays the same. This makes it
        viscerally clear: the program is a <strong>template</strong>, and
        the runtime data fills in the blanks.
      </p>
    </div>
  ),
};

export const WidgetOnly: Story = {};
