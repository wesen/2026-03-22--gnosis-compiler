import { Header } from './components/Header/Header';
import { Editor } from './components/Editor/Editor';
import { Canvas } from './components/Canvas/Canvas';
import { ResizeHandle } from './components/ResizeHandle';
import { TabBar } from './components/Inspector/TabBar';
import { Inspector } from './components/Inspector/Inspector';
import { useAutoCompile } from './hooks/useAutoCompile';

export function App() {
  useAutoCompile();

  return (
    <div data-widget="gnosis-workbench" data-part="root">
      <Header />
      <Editor />
      <Canvas />
      <ResizeHandle />
      <TabBar />
      <Inspector />
    </div>
  );
}
