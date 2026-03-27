import type { Meta, StoryObj } from '@storybook/react';
import { StackCalculator } from './StackCalculator';
import type { StackInstruction } from './StackCalculator';
import '../../../styles/explorer.css';

const meta: Meta<typeof StackCalculator> = {
  title: 'Explorer/1 — The Stack Machine',
  component: StackCalculator,
  parameters: {
    layout: 'fullscreen',
    backgrounds: { default: 'terminal' },
  },
};

export default meta;
type Story = StoryObj<typeof StackCalculator>;

/** Full article screen with prose + embedded widget */
export const Article: Story = {
  render: () => (
    <div data-part="explorer-article">
      <h1>HOW THE GNOSIS DYNAMIC VM WORKS</h1>

      <p>
        The GNOSIS dynamic VM is a <strong>stack-based virtual machine</strong> that
        takes a compiled layout description and turns it into pixels on an e-ink
        display. This article walks you through each concept interactively.
      </p>

      <h2>1. THE STACK MACHINE</h2>

      <p>
        The VM uses a <strong>stack</strong> to compute values. Instructions push
        values onto the stack, perform arithmetic, and pop results into named
        storage locations called <strong>"slots."</strong>
      </p>

      <p>
        Try it: <strong>edit the numbers</strong> in the instruction list below
        and watch the stack change. Press <code>STEP</code> to advance one
        instruction at a time, or <code>RUN ALL</code> to execute everything.
      </p>

      <div data-part="explorer-widget-stack">
        <StackCalculator />
      </div>

      <p>
        Notice how <code>ADD</code> popped two values and pushed one. The stack
        is a <strong>last-in, first-out (LIFO)</strong> structure — the most
        recently pushed value is always on top.
      </p>

      <p>
        The final <code>STORE_SLOT</code> instruction pops the computed result
        off the stack and writes it into a named slot. Slots are the VM's
        persistent memory — they hold layout coordinates like position and size.
      </p>

      <p>
        Try changing <code>42</code> to <code>100</code> above. The final
        result changes immediately because the widget re-calculates the
        entire program from scratch.
      </p>
    </div>
  ),
};

/** Widget only — no article prose */
export const WidgetOnly: Story = {};

/** Custom program: subtraction */
export const SubtractionExample: Story = {
  args: {
    initialInstructions: [
      { type: 'PUSH_CONST', value: 260 },
      { type: 'PUSH_CONST', value: 8 },
      { type: 'SUB' },
      { type: 'PUSH_CONST', value: 40 },
      { type: 'SUB' },
      { type: 'STORE_SLOT', slot: 'n1.w' },
    ] satisfies StackInstruction[],
  },
};

/** Custom program: max of two values */
export const MaxExample: Story = {
  args: {
    initialInstructions: [
      { type: 'PUSH_CONST', value: 96 },
      { type: 'PUSH_CONST', value: 120 },
      { type: 'MAX' },
      { type: 'STORE_SLOT', slot: 'n2.w' },
    ] satisfies StackInstruction[],
  },
};

/** Multiple stores */
export const MultipleStores: Story = {
  args: {
    initialInstructions: [
      { type: 'PUSH_CONST', value: 8 },
      { type: 'STORE_SLOT', slot: 'n0.x' },
      { type: 'PUSH_CONST', value: 8 },
      { type: 'PUSH_CONST', value: 16 },
      { type: 'ADD' },
      { type: 'STORE_SLOT', slot: 'n0.y' },
      { type: 'PUSH_CONST', value: 200 },
      { type: 'STORE_SLOT', slot: 'n0.w' },
    ] satisfies StackInstruction[],
  },
};
