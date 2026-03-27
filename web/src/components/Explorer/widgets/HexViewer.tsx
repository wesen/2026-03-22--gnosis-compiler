import { useState, useMemo } from 'react';

// ── Types ───────────────────────────────────────────────────────────────────

interface Region {
  start: number;
  end: number;
  label: string;
  description: string;
  color: string;
}

interface HexViewerProps {
  /** Raw bytes to display. If not provided, uses a built-in sample GNDY program. */
  data?: Uint8Array;
  /** Region annotations. If not provided, auto-generates from sample program. */
  regions?: Region[];
}

// ── Sample GNDY program ─────────────────────────────────────────────────────

function buildSampleProgram(): { data: Uint8Array; regions: Region[] } {
  const bytes: number[] = [];
  const regions: Region[] = [];
  let off = 0;

  // Magic: "GNDY"
  const magic = [0x47, 0x4e, 0x44, 0x59];
  bytes.push(...magic);
  regions.push({ start: off, end: off + 4, label: 'MAGIC', description: '"GNDY" — identifies this as a GNDY bytecode file', color: 'var(--color-accent)' });
  off += 4;

  // Version: 1
  bytes.push(0x01);
  regions.push({ start: off, end: off + 1, label: 'VERSION', description: 'Format version = 1', color: 'var(--color-green)' });
  off += 1;

  // Header: node_count(2), slot_count(2), bind_count(2), string_count(2), code_len(4)
  bytes.push(0x00, 0x04); // 4 nodes
  regions.push({ start: off, end: off + 2, label: 'NODES', description: 'Node count = 4 (each has 6 slots)', color: 'var(--color-orange)' });
  off += 2;

  bytes.push(0x00, 0x18); // 24 slots
  regions.push({ start: off, end: off + 2, label: 'SLOTS', description: 'Slot count = 24 (4 nodes × 6 fields)', color: 'var(--color-orange)' });
  off += 2;

  bytes.push(0x00, 0x01); // 1 bind
  regions.push({ start: off, end: off + 2, label: 'BINDS', description: 'Bind count = 1 (runtime value references)', color: 'var(--color-orange)' });
  off += 2;

  bytes.push(0x00, 0x01); // 1 string
  regions.push({ start: off, end: off + 2, label: 'STRINGS', description: 'String count = 1 (constant text)', color: 'var(--color-orange)' });
  off += 2;

  bytes.push(0x00, 0x00, 0x00, 0x0a); // 10 bytes of code
  regions.push({ start: off, end: off + 4, label: 'CODE_LEN', description: 'Code section length = 10 bytes', color: 'var(--color-orange)' });
  off += 4;

  // Bind table: 1 bind "title"
  const titleBytes = [...new TextEncoder().encode('title')];
  bytes.push(0x00, titleBytes.length, ...titleBytes);
  regions.push({ start: off, end: off + 2 + titleBytes.length, label: 'BIND TABLE', description: 'Bind #0: "title" (length-prefixed UTF-8)', color: 'var(--color-dim)' });
  off += 2 + titleBytes.length;

  // String pool: 1 string "HI"
  const hiBytes = [...new TextEncoder().encode('HI')];
  bytes.push(0x00, hiBytes.length, ...hiBytes);
  regions.push({ start: off, end: off + 2 + hiBytes.length, label: 'STRING POOL', description: 'String #0: "HI" (length-prefixed UTF-8)', color: 'var(--color-dim)' });
  off += 2 + hiBytes.length;

  // Slot init: 24 × u16 = 48 bytes (all zero)
  for (let i = 0; i < 24; i++) bytes.push(0x00, 0x00);
  regions.push({ start: off, end: off + 48, label: 'SLOT INIT', description: 'Initial slot values: 24 × u16 (all zero = layout not yet computed)', color: 'var(--color-dim2)' });
  off += 48;

  // Code section: MEASURE_TEXT_BIND(6B) + PUSH_SLOT(3B) + HALT(1B) = 10 bytes
  bytes.push(0x01, 0x00, 0x00, 0x00, 0x00, 0x02); // MEASURE_TEXT_BIND node=0 bind=0 size=2
  regions.push({ start: off, end: off + 6, label: 'MEASURE_TEXT_BIND', description: 'Opcode 0x01: MEASURE_TEXT_BIND node=0 bind=0 fontSize=2', color: 'var(--color-accent)' });
  off += 6;

  bytes.push(0x03, 0x00, 0x00); // PUSH_SLOT slot=0 (n0.mw)
  regions.push({ start: off, end: off + 3, label: 'PUSH_SLOT', description: 'Opcode 0x03: PUSH_SLOT slot=0 (n0.mw — push measured width)', color: 'var(--color-accent)' });
  off += 3;

  bytes.push(0xff); // HALT
  regions.push({ start: off, end: off + 1, label: 'HALT', description: 'Opcode 0xFF: HALT — stop execution', color: 'var(--color-red)' });
  off += 1;

  return { data: new Uint8Array(bytes), regions };
}

// ── Component ───────────────────────────────────────────────────────────────

export function HexViewer({ data: dataProp, regions: regionsProp }: HexViewerProps) {
  const { data, regions } = useMemo(() => {
    if (dataProp && regionsProp) return { data: dataProp, regions: regionsProp };
    return buildSampleProgram();
  }, [dataProp, regionsProp]);

  const [hoveredRegion, setHoveredRegion] = useState<Region | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<Region | null>(null);

  const activeRegion = selectedRegion ?? hoveredRegion;

  // Build rows of 16 bytes
  const rows: Array<{ offset: number; bytes: number[]; ascii: string }> = [];
  for (let i = 0; i < data.length; i += 16) {
    const bytes: number[] = [];
    let ascii = '';
    for (let j = 0; j < 16 && i + j < data.length; j++) {
      const b = data[i + j]!;
      bytes.push(b);
      ascii += b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : '.';
    }
    rows.push({ offset: i, bytes, ascii });
  }

  function getRegionForByte(byteIdx: number): Region | undefined {
    return regions.find((r) => byteIdx >= r.start && byteIdx < r.end);
  }

  return (
    <div data-part="hex-viewer-widget">
      {/* Hex dump */}
      <div className="hv-hex-container">
        {rows.map((row) => (
          <div key={row.offset} className="hv-row">
            <span className="hv-offset">{row.offset.toString(16).padStart(4, '0')}</span>
            <span className="hv-bytes">
              {row.bytes.map((b, j) => {
                const byteIdx = row.offset + j;
                const region = getRegionForByte(byteIdx);
                const isActive = activeRegion && byteIdx >= activeRegion.start && byteIdx < activeRegion.end;
                return (
                  <span
                    key={j}
                    className="hv-byte"
                    data-state={isActive ? 'active' : undefined}
                    style={isActive ? { color: activeRegion!.color } : undefined}
                    onMouseEnter={() => region && setHoveredRegion(region)}
                    onMouseLeave={() => setHoveredRegion(null)}
                    onClick={() => region && setSelectedRegion(region === selectedRegion ? null : region)}
                  >
                    {b.toString(16).padStart(2, '0')}
                  </span>
                );
              })}
            </span>
            <span className="hv-ascii">{row.ascii}</span>
          </div>
        ))}
      </div>

      {/* Tooltip / description */}
      <div className="hv-info">
        {activeRegion ? (
          <>
            <span className="hv-info-label" style={{ color: activeRegion.color }}>
              [{activeRegion.label}]
            </span>
            <span className="hv-info-range">
              bytes {activeRegion.start.toString(16)}–{(activeRegion.end - 1).toString(16)}
            </span>
            <span className="hv-info-desc">{activeRegion.description}</span>
          </>
        ) : (
          <span className="hv-info-hint">Hover over any byte to see what it means. Click to pin.</span>
        )}
      </div>

      {/* Region legend */}
      <div className="hv-legend">
        {regions.map((r, i) => (
          <button
            key={i}
            className="hv-legend-item"
            data-state={activeRegion === r ? 'active' : undefined}
            onMouseEnter={() => setHoveredRegion(r)}
            onMouseLeave={() => setHoveredRegion(null)}
            onClick={() => setSelectedRegion(r === selectedRegion ? null : r)}
          >
            <span className="hv-legend-swatch" style={{ background: r.color }} />
            <span>{r.label}</span>
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="hv-stats">
        Total: <strong>{data.length}</strong> bytes
        {' '}{'\u2502'}{' '}
        Regions: <strong>{regions.length}</strong>
      </div>
    </div>
  );
}
