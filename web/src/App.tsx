import { useMemo } from 'react';
import { Header } from './components/Header/Header';
import { Editor } from './components/Editor/Editor';
import { Canvas } from './components/Canvas/Canvas';
import { ResizeHandle } from './components/ResizeHandle';
import { TabBar } from './components/Inspector/TabBar';
import { Inspector } from './components/Inspector/Inspector';
import { useAutoCompile } from './hooks/useAutoCompile';
import { useAutoLoadPreset } from './hooks/useAutoLoadPreset';
import { useAppSelector } from './store/hooks';

export function App() {
  useAutoLoadPreset();
  useAutoCompile();

  const inspectorHeight = useAppSelector((s) => s.inspector.inspectorHeight);
  const style = useMemo(
    () => ({ '--inspector-height': `${inspectorHeight}px` }) as React.CSSProperties,
    [inspectorHeight],
  );

  return (
    <div data-widget="gnosis-workbench" data-part="root" style={style}>
      <Header />
      <Editor />
      <Canvas />
      <ResizeHandle />
      <TabBar />
      <Inspector />
    </div>
  );
}
