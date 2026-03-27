import { useAppSelector } from '../../../store/hooks';

export function RegionsPanel() {
  const regions = useAppSelector((s) => s.compiler.compileResult?.program.regions ?? []);

  if (regions.length === 0) {
    return (
      <div style={{ padding: 8, color: 'var(--color-dim)' }}>
        No refresh regions (no runtime binds)
      </div>
    );
  }

  return (
    <div>
      {regions.map((reg, i) => {
        const r = reg.rect;
        return (
          <div key={i} className="region-item">
            <b>Region {i}</b>{' '}
            <span className="ast-rect">
              ({r.x},{r.y} {r.w}x{r.h})
            </span>{' '}
            waveform=<b>{reg.waveform}</b> binds=[{reg.bind_names.join(', ')}]
          </div>
        );
      })}
    </div>
  );
}
