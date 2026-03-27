import type { Meta, StoryObj } from '@storybook/react';
import { HexViewer } from './HexViewer';
import '../../../styles/explorer.css';

const meta: Meta<typeof HexViewer> = {
  title: 'Explorer/5 — The Binary Format',
  component: HexViewer,
  parameters: {
    layout: 'fullscreen',
    backgrounds: { default: 'terminal' },
  },
};

export default meta;
type Story = StoryObj<typeof HexViewer>;

export const Article: Story = {
  render: () => (
    <div data-part="explorer-article">
      <h1>HOW THE GNOSIS DYNAMIC VM WORKS</h1>

      <h2>5. THE BINARY FORMAT</h2>

      <p>
        The compiled program is a <strong>binary blob</strong> — a sequence of
        bytes that the VM can decode and execute. The format is called
        <strong> GNDY</strong> (GNOSIS DYnamic) and has a fixed structure:
      </p>

      <p>
        <code>MAGIC</code> (4 bytes) {'\u2192'} <code>VERSION</code> (1 byte)
        {' '}{'\u2192'} <code>HEADER</code> (12 bytes: node/slot/bind/string counts + code length)
        {' '}{'\u2192'} <code>BIND TABLE</code> {'\u2192'} <code>STRING POOL</code>
        {' '}{'\u2192'} <code>SLOT INIT</code> {'\u2192'} <code>CODE</code>
      </p>

      <p>
        <strong>Hover over any byte</strong> below to see what it represents.
        Click a byte to pin the annotation. Click a label in the legend to
        highlight that region.
      </p>

      <div data-part="explorer-widget-hex">
        <HexViewer />
      </div>

      <p>
        Every value larger than a byte is stored <strong>big-endian</strong> (most
        significant byte first). This matches the convention of network protocols
        and makes hex dumps more readable — the bytes appear in the same
        order as the number written in hex.
      </p>

      <p>
        The <strong>bind table</strong> and <strong>string pool</strong> use
        length-prefixed UTF-8 encoding. Each entry starts with a 2-byte
        length, followed by that many bytes of text. This is compact and
        avoids null terminators.
      </p>

      <p>
        The <strong>code section</strong> is a flat sequence of opcodes and
        their operands. Each opcode has a fixed size (1–9 bytes), so the
        decoder can step through without ambiguity. There are 17 opcodes
        total, from <code>MEASURE_TEXT_BIND</code> (0x01) to
        <code> HALT</code> (0xFF).
      </p>
    </div>
  ),
};

export const WidgetOnly: Story = {};
