import type { FC } from 'react';
import type { CompilerMode } from '../../store/slices/compilerSlice';

export interface PanelRegistration {
  id: string;
  label: string;
  modes: CompilerMode[];
  component: FC;
}

/**
 * Central panel registry. Static panels are registered here.
 * GNOSIS-003 dynamic panels will be added to this array.
 */
const registry: PanelRegistration[] = [];

export function registerPanel(panel: PanelRegistration) {
  // Avoid duplicates
  if (!registry.find((p) => p.id === panel.id)) {
    registry.push(panel);
  }
}

export function getPanels(): readonly PanelRegistration[] {
  return registry;
}

export function getPanelsForMode(mode: CompilerMode): PanelRegistration[] {
  return registry.filter((p) => p.modes.includes(mode));
}

export function getPanelById(id: string): PanelRegistration | undefined {
  return registry.find((p) => p.id === id);
}
