import { useAppSelector } from '../../../store/hooks';
import { base64ToBytes } from '../../../engine';

export function HexPanel() {
  const bytecodeBase64 = useAppSelector((s) => s.compiler.compileResult?.bytecode_base64);

  if (!bytecodeBase64) {
    return <pre style={{ padding: 8, color: 'var(--color-dim)' }}>No bytecode</pre>;
  }

  const bytes = base64ToBytes(bytecodeBase64);
  const rows: React.ReactNode[] = [];

  for (let i = 0; i < bytes.length; i += 16) {
    const hexParts: React.ReactNode[] = [];
    let ascii = '';

    for (let j = 0; j < 16; j++) {
      if (i + j < bytes.length) {
        const b = bytes[i + j]!;
        hexParts.push(
          <span key={j} className="hex-byte">
            {b.toString(16).padStart(2, '0').toUpperCase()}
          </span>,
        );
        ascii += b >= 32 && b < 127 ? String.fromCharCode(b) : '.';
      } else {
        hexParts.push(
          <span key={j} className="hex-byte" style={{ color: 'var(--color-bg2)' }}>
            {'  '}
          </span>,
        );
        ascii += ' ';
      }
    }

    rows.push(
      <div key={i} className="hex-row">
        <span className="hex-off">{i.toString(16).padStart(4, '0').toUpperCase()}</span>
        <span className="hex-bytes">{hexParts}</span>
        <span className="hex-ascii">{ascii}</span>
      </div>,
    );
  }

  return <div>{rows}</div>;
}
