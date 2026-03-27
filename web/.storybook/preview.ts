import type { Preview } from '@storybook/react';
import '../src/components/Inspector/registerPanels';
import '../src/styles/workbench.css';
import '../src/styles/theme-terminal.css';

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: 'terminal',
      values: [
        { name: 'terminal', value: '#0c0b0a' },
        { name: 'light', value: '#f5f3ef' },
      ],
    },
  },
};

export default preview;
