import { useAppSelector } from '../../../store/hooks';

export function StatsPanel() {
  const compileResult = useAppSelector((s) => s.compiler.compileResult);

  if (!compileResult) {
    return <pre style={{ padding: 8, color: 'var(--color-dim)' }}>No data</pre>;
  }

  const p = compileResult.program;
  const s = p.stats;

  return (
    <div className="stats-grid">
      <div className="stat-card">
        <h3>NODES</h3>
        Input: <span className="val">{s.input_nodes}</span>
        <br />
        Final: <span className="val">{s.final_nodes}</span>
        <br />
        Static: <span className="val" style={{ color: 'var(--color-green)' }}>{s.static_nodes}</span>
        <br />
        Dynamic: <span className="val" style={{ color: 'var(--color-orange)' }}>{s.dynamic_nodes}</span>
      </div>

      <div className="stat-card">
        <h3>BYTECODE</h3>
        Code size: <span className="val">{s.code_size} B</span>
        <br />
        Binary size:{' '}
        <span className="val">
          {compileResult.binary_base64
            ? Math.ceil((compileResult.binary_base64.length * 3) / 4)
            : 0}{' '}
          B
        </span>
        <br />
        Strings: <span className="val">{s.string_count}</span>
        <br />
        Regions: <span className="val">{s.region_count}</span>
      </div>

      <div className="stat-card">
        <h3>BINDS</h3>
        {p.binds.map((b) => (
          <div key={b}>
            <span className="val">{b}</span>
          </div>
        ))}
      </div>

      <div className="stat-card">
        <h3>STRINGS</h3>
        {p.strings.map((str, i) => (
          <div key={i}>
            <span className="ast-prop">[{i}]</span> <span className="val">"{str}"</span>
          </div>
        ))}
      </div>

      <div className="stat-card">
        <h3>PASSES</h3>
        {(s.passes ?? []).map((pass) => (
          <div key={pass.name}>
            {pass.name}: {pass.before} → {pass.after}
          </div>
        ))}
      </div>
    </div>
  );
}
