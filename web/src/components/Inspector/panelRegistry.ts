import type { FC } from 'react';

export interface PanelRegistration {
  id: string;
  label: string;
  component: FC;
}

const registry: PanelRegistration[] = [];

export function registerPanel(panel: PanelRegistration) {
  if (!registry.find((p) => p.id === panel.id)) {
    registry.push(panel);
  }
}

export function getPanels(): readonly PanelRegistration[] {
  return registry;
}

export function getPanelById(id: string): PanelRegistration | undefined {
  return registry.find((panel) => panel.id === id);
}
