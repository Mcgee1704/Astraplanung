import React, { useId, useRef } from 'react';
import { catalog } from './templates.js';
import {
  clampPosition,
  envelope,
  extractionPath,
  formatMM,
  isOpening,
  isVisible,
} from './geometry.js';

export const materials = {
  bed: ['#c0c9ad', '#596b50'],
  bench: ['#b4c4a8', '#5c7057'],
  table: ['#ead4ac', '#82673e'],
  kitchen: ['#e0bb8d', '#86613e'],
  cabinet: ['#dbc9aa', '#87714f'],
  overhead: ['#d7c8aa', '#7c6948'],
  bath: ['#cfdfdb', '#597d79'],
  toilet: ['#dde9e2', '#60807b'],
  fresh: ['#a6c7ce', '#477985'],
  grey: ['#c6ced3', '#687b86'],
  battery: ['#d8cfa5', '#8e8048'],
  solar: ['#8ca5ae', '#4d6a78'],
  heater: ['#dbb69d', '#92694d'],
  pump: ['#9ac9c2', '#477b78'],
  fridge: ['#ccd8d0', '#6c8171'],
  wheelarch: ['#cacdc8', '#727c72'],
  wall: ['#b7bba6', '#747b62'],
  roofvent: ['#b5d4d3', '#5a7e84'],
  door: ['#fbfaf3', '#697a69'],
  window: ['#d2e7e9', '#527d82'],
  hatch: ['#d7e2cc', '#657858'],
  custom: ['#d4c4bd', '#866f65'],
  sink: ['#c9d5cc', '#718174'],
  shower: ['#d2e1dd', '#5e837e'],
  boiler: ['#c9dcdd', '#6a8686'],
  light: ['#e6d9aa', '#877849'],
  controller: ['#d4c9a5', '#857750'],
  inverter: ['#cccbb6', '#78755b'],
  fusebox: ['#d0c4ab', '#8f7351'],
  vent: ['#bbd4d2', '#627f81'],
  floor: ['#d4c2a3', '#8d795e'],
  insulation: ['#d8d9c4', '#82826a'],
  inlet: ['#d0dbd0', '#718477'],
};
const colors = (kind) => materials[kind] || materials.custom;
export const drawingBounds = (vehicle) => {
  const { length, width } = envelope(vehicle);
  const k = Math.max(width, length * 0.39);
  const cab = Math.min(length * 0.23, width * 0.53);
  return {
    x: -cab - 0.1 * k,
    y: -0.235 * k,
    width: length + cab + 0.36 * k,
    height: width + 0.36 * k,
    cab,
    k,
  };
};

function Cabin({ length: L, width: W, cab: C, unit: u }) {
  const inset = u * 0.58,
    cx = -C,
    right = L + inset;
  const body =
    'M ' +
    -inset +
    ' ' +
    -inset +
    ' H ' +
    (right - inset) +
    ' Q ' +
    right +
    ' ' +
    -inset +
    ' ' +
    right +
    ' 0 V ' +
    W +
    ' Q ' +
    right +
    ' ' +
    (W + inset) +
    ' ' +
    L +
    ' ' +
    (W + inset) +
    ' H ' +
    -inset +
    ' Q ' +
    (cx + C * 0.3) +
    ' ' +
    (W + inset) +
    ' ' +
    (cx + C * 0.11) +
    ' ' +
    W * 0.92 +
    ' Q ' +
    (cx - C * 0.04) +
    ' ' +
    W * 0.83 +
    ' ' +
    cx +
    ' ' +
    W * 0.65 +
    ' V ' +
    W * 0.34 +
    ' Q ' +
    cx +
    ' ' +
    W * 0.16 +
    ' ' +
    (cx + C * 0.16) +
    ' ' +
    W * 0.08 +
    ' Q ' +
    (cx + C * 0.32) +
    ' ' +
    -inset +
    ' ' +
    -inset +
    ' ' +
    -inset +
    ' Z';
  return (
    <g strokeLinejoin="round" strokeLinecap="round">
      <path d={body} fill="#e2e6dc" stroke="#4f6055" strokeWidth={u * 0.29} />
      <path
        d={
          'M ' +
          -C * 0.77 +
          ' ' +
          W * 0.14 +
          ' Q ' +
          -C * 1.02 +
          ' ' +
          W * 0.5 +
          ' ' +
          -C * 0.77 +
          ' ' +
          W * 0.86 +
          ' L ' +
          -C * 0.54 +
          ' ' +
          W * 0.78 +
          ' Q ' +
          -C * 0.7 +
          ' ' +
          W * 0.5 +
          ' ' +
          -C * 0.54 +
          ' ' +
          W * 0.22 +
          ' Z'
        }
        fill="#bacac3"
        stroke="#788c81"
        strokeWidth={u * 0.18}
      />
      {[0.22, 0.64].map((y) => (
        <g
          key={y}
          transform={'translate(' + -C * 0.46 + ',' + W * y + ')'}
          stroke="#728173"
          strokeWidth={u * 0.18}
        >
          <rect
            width={C * 0.32}
            height={W * 0.14}
            rx={u * 0.7}
            fill="#c1c9ba"
          />
          <rect
            x={C * 0.26}
            y={-W * 0.007}
            width={C * 0.09}
            height={W * 0.154}
            rx={u * 0.32}
            fill="#aab5a5"
          />
        </g>
      ))}
      <path
        d={
          'M ' +
          -C * 0.64 +
          ' ' +
          W * 0.035 +
          ' L ' +
          -C * 0.32 +
          ' ' +
          -W * 0.022 +
          ' M ' +
          -C * 0.64 +
          ' ' +
          W * 0.965 +
          ' L ' +
          -C * 0.32 +
          ' ' +
          W * 1.022
        }
        stroke="#718174"
        strokeWidth={u * 0.34}
      />
      <rect
        width={L}
        height={W}
        fill="#faf7eb"
        stroke="#5e6859"
        strokeWidth={u * 0.25}
      />
    </g>
  );
}

function IntrinsicDetail({ item, ink, unit: u }) {
  const { kind, length: l, width: w } = item;
  const p = Math.min(l, w) * 0.07,
    detail = { stroke: ink, strokeWidth: u * 0.15, fill: 'none' };
  const line = (x1, y1, x2, y2, key = 'l') => (
    <line key={key} {...detail} {...{ x1, y1, x2, y2 }} />
  );
  const rect = (x, y, width, height, rx = 0, fill = 'none', key = 'r') => (
    <rect key={key} {...detail} {...{ x, y, width, height, rx, fill }} />
  );
  if (kind === 'bed') {
    const across = w >= l;
    return across ? (
      <g>
        {rect(p, p, l * 0.38, w * 0.17, p * 0.6, '#dce2ce', 'a')}
        {rect(l * 0.54, p, l * 0.38, w * 0.17, p * 0.6, '#dce2ce', 'b')}
        {line(0, w * 0.31, l, w * 0.31)}
        {line(0, w * 0.34, l, w * 0.34, 'fold')}
        {Array.from({ length: 4 }, (_, i) =>
          line((l * (i + 1)) / 5, w * 0.36, (l * (i + 1)) / 5, w - p, 'q' + i),
        )}
      </g>
    ) : (
      <g>
        {rect(p, p, l * 0.16, w * 0.38, p * 0.6, '#dce2ce', 'a')}
        {rect(p, w * 0.54, l * 0.16, w * 0.38, p * 0.6, '#dce2ce', 'b')}
        {line(l * 0.3, 0, l * 0.3, w)}
        {line(l * 0.33, 0, l * 0.33, w, 'fold')}
        {[0.27, 0.52, 0.77].map((f) =>
          line(l * 0.35, w * f, l - p, w * f, 'q' + f),
        )}
      </g>
    );
  }
  if (kind === 'kitchen') {
    const sideways = w > l,
      long = sideways ? w : l,
      short = sideways ? l : w;
    const r = Math.min(long * 0.075, short * 0.19);
    return (
      <g transform={sideways ? 'translate(' + l + ',0) rotate(90)' : undefined}>
        {rect(
          long * 0.06,
          short * 0.15,
          long * 0.33,
          short * 0.69,
          p * 0.6,
          '#ebd6b5',
          'sink',
        )}
        {rect(
          long * 0.083,
          short * 0.21,
          long * 0.278,
          short * 0.56,
          p * 0.5,
          '#d4c7a8',
          'sink2',
        )}
        <path
          d={
            'M ' +
            long * 0.18 +
            ' ' +
            short * 0.17 +
            ' v ' +
            -short * 0.11 +
            ' h ' +
            long * 0.064
          }
          {...detail}
        />
        {rect(
          long * 0.62,
          short * 0.12,
          long * 0.33,
          short * 0.76,
          p * 0.5,
          '#d5bd9a',
          'hob',
        )}
        {[0.31, 0.69].map((y) => (
          <circle key={y} cx={long * 0.783} cy={short * y} r={r} {...detail} />
        ))}
        {line(long * 0.51, 0, long * 0.51, short)}
      </g>
    );
  }
  if (kind === 'bath')
    return (
      <g>
        {rect(p, p, l - p * 2, w - p * 2, p * 0.6, '#dae5dd', 'basin')}
        {line(p, p, l - p, w - p, 'd1')}
        {line(p, w - p, l - p, p, 'd2')}
        <circle cx={l * 0.47} cy={w * 0.53} r={p * 0.44} fill={ink} />
        {rect(
          l * 0.62,
          w * 0.12,
          l * 0.2,
          w * 0.12,
          p * 0.35,
          '#eaf0e7',
          'tank',
        )}
        <ellipse
          cx={l * 0.72}
          cy={w * 0.3}
          rx={l * 0.105}
          ry={w * 0.125}
          fill="#eaf0e7"
          stroke={ink}
          strokeWidth={u * 0.13}
        />
      </g>
    );
  if (kind === 'bench')
    return (
      <g>
        {rect(p, p, l - 2 * p, w - 2 * p, p * 0.55, 'none')}
        {w < l
          ? line(l * 0.5, p, l * 0.5, w - p)
          : line(p, w * 0.5, l - p, w * 0.5)}
        {w < l
          ? line(p, w * 0.84, l - p, w * 0.84, 'back')
          : line(l * 0.84, p, l * 0.84, w - p, 'back')}
      </g>
    );
  if (kind === 'table')
    return <g>{rect(p * 0.7, p * 0.7, l - p * 1.4, w - p * 1.4, p * 0.8)}</g>;
  if (kind === 'solar')
    return (
      <g>
        {Array.from({ length: 6 }, (_, i) =>
          line(((i + 1) * l) / 7, 0, ((i + 1) * l) / 7, w, 'a' + i),
        )}
        {Array.from({ length: 3 }, (_, i) =>
          line(0, ((i + 1) * w) / 4, l, ((i + 1) * w) / 4, 'b' + i),
        )}
      </g>
    );
  if (kind === 'fresh' || kind === 'grey')
    return (
      <g>
        {rect(p, p, l - p * 2, w - p * 2, p)}
        <circle cx={l * 0.78} cy={w * 0.28} r={p * 0.95} {...detail} />
        {line(p * 2, w * 0.74, l * 0.34, w * 0.74)}
      </g>
    );
  if (kind === 'battery')
    return (
      <g>
        {['+', '−'].map((s, i) => (
          <text
            key={s}
            x={l * (i ? 0.76 : 0.18)}
            y={w * 0.5}
            fontSize={Math.min(l, w) * 0.38}
            fill={ink}
            textAnchor="middle"
          >
            {s}
          </text>
        ))}
      </g>
    );
  if (['cabinet', 'overhead', 'fridge'].includes(kind))
    return (
      <g>
        {rect(p, p, l - p * 2, w - p * 2, p * 0.22)}
        {line(l * 0.45, w * 0.2, l * 0.62, w * 0.2, 'handle')}
        {kind === 'cabinet' && line(p, w - p, l - p, p, 'grain')}
      </g>
    );
  if (kind === 'sink' || kind === 'shower')
    return (
      <g>
        {rect(p, p, l - p * 2, w - p * 2, p * 0.7, 'none', 'rim')}
        <circle cx={l * 0.61} cy={w * 0.62} r={p * 0.46} {...detail} />
      </g>
    );
  if (
    [
      'heater',
      'roofvent',
      'vent',
      'controller',
      'inverter',
      'fusebox',
    ].includes(kind)
  )
    return (
      <g>
        {[0.22, 0.36, 0.5, 0.64, 0.78].map((f) =>
          line(l * f, w * 0.2, l * f, w * 0.8, 'h' + f),
        )}
      </g>
    );
  if (kind === 'pump')
    return (
      <g>
        <circle
          cx={l * 0.56}
          cy={w * 0.5}
          r={Math.min(l, w) * 0.25}
          {...detail}
        />
        {line(0, w * 0.5, l * 0.36, w * 0.5)}
      </g>
    );
  return null;
}

export function ObjectDetail({ item, ink, unit }) {
  const angle = (((item.rotation || 0) % 360) + 360) % 360;
  const { length: l, width: w } = item;
  const raw =
    angle === 90 || angle === 270 ? { ...item, length: w, width: l } : item;
  const transform =
    angle === 90
      ? 'translate(' + l + ',0) rotate(90)'
      : angle === 180
        ? 'translate(' + l + ',' + w + ') rotate(180)'
        : angle === 270
          ? 'translate(0,' + w + ') rotate(270)'
          : undefined;
  return (
    <g transform={transform}>
      <IntrinsicDetail item={raw} ink={ink} unit={unit} />
    </g>
  );
}

function Opening({ item, unit: u, color }) {
  const { width: w, length: l, side } = item,
    lateral = side === 'left' || side === 'right';
  const cx = l / 2,
    cy = w / 2;
  return (
    <g stroke={color} strokeWidth={u * 0.26}>
      <line
        x1={lateral ? 0 : cx}
        x2={lateral ? l : cx}
        y1={lateral ? cy : 0}
        y2={lateral ? cy : w}
        stroke="#f9f6e9"
        strokeWidth={u * 0.95}
      />
      <line
        x1={lateral ? 0 : cx}
        x2={lateral ? l : cx}
        y1={lateral ? cy : 0}
        y2={lateral ? cy : w}
        strokeDasharray={
          item.kind === 'door' ? u * 0.6 + ' ' + u * 0.45 : undefined
        }
      />
      {lateral ? (
        <>
          <path
            d={
              'M 0 ' +
              -u * 0.32 +
              ' v ' +
              (w + u * 0.64) +
              ' M ' +
              l +
              ' ' +
              -u * 0.32 +
              ' v ' +
              (w + u * 0.64)
            }
            fill="none"
          />
        </>
      ) : (
        <path
          d={
            'M ' +
            -u * 0.32 +
            ' 0 h ' +
            (l + u * 0.64) +
            ' M ' +
            -u * 0.32 +
            ' ' +
            w +
            ' h ' +
            (l + u * 0.64)
          }
          fill="none"
        />
      )}
    </g>
  );
}

function Part({
  item,
  roomWidth,
  unit: u,
  selected,
  interactive,
  onPointerDown,
  onSelect,
  labels,
  number,
}) {
  const { x, y, length: l, width: w } = item;
  const [fill, ink] = colors(item.kind);
  const isOpen = isOpening(item);
  const name = item.name || catalog[item.kind]?.name || 'Bauteil';
  const fontSize = Math.min(
    u * 1.77,
    l / (Math.max(name.length, 4) * 0.6),
    w * 0.72,
  );
  const labelW = fontSize * name.length * 0.56 + u * 0.53;
  const showLabel =
    !isOpen && labels && (number || (fontSize > u * 0.85 && w > u * 3.1));
  const idLabel = number ?? name;
  return (
    <g
      transform={'translate(' + x + ',' + (roomWidth - y) + ') scale(1,-1)'}
      data-layout-item={item.id}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? name + ' auswählen' : undefined}
      onPointerDown={interactive ? (e) => onPointerDown?.(e, item) : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(item.id);
              }
            }
          : undefined
      }
      style={
        interactive
          ? { cursor: 'grab', outlineOffset: 4, touchAction: 'none' }
          : undefined
      }
    >
      <title>
        {name +
          ' · ' +
          formatMM(l) +
          ' × ' +
          formatMM(w) +
          ' mm · Z ' +
          formatMM(item.z) +
          ' mm'}
      </title>
      {isOpen ? (
        <Opening item={item} unit={u} color={ink} />
      ) : (
        <>
          <rect
            width={l}
            height={w}
            rx={
              Math.min(l, w, u * 2) *
              (['bed', 'bench', 'table'].includes(item.kind) ? 0.42 : 0.13)
            }
            fill={fill}
            stroke={ink}
            strokeWidth={u * 0.29}
          />
          <g pointerEvents="none">
            <ObjectDetail item={item} ink={ink} unit={u} />
          </g>
        </>
      )}
      {showLabel && (
        <g
          pointerEvents="none"
          transform={'translate(0,' + w + ') scale(1,-1)'}
        >
          <rect
            x={l / 2 - (number ? u * 1.22 : labelW) / 2}
            y={w / 2 - (number ? u * 1.55 : fontSize * 1.28) / 2}
            width={number ? u * 1.22 : labelW}
            height={number ? u * 1.55 : fontSize * 1.28}
            rx={u * 0.19}
            fill={fill}
            fillOpacity=".93"
          />
          <text
            x={l / 2}
            y={w / 2}
            dy=".34em"
            textAnchor="middle"
            fontSize={number ? u * 1.18 : fontSize}
            fontWeight="650"
            fill="#334435"
          >
            {idLabel}
          </text>
        </g>
      )}
      {isOpen && (
        <rect
          x={-u * 0.45}
          y={-u * 0.45}
          width={l + u * 0.9}
          height={w + u * 0.9}
          fill="transparent"
        />
      )}
      {isOpen && number && (
        <g
          pointerEvents="none"
          transform={'translate(0,' + w + ') scale(1,-1)'}
        >
          <circle
            cx={l / 2}
            cy={w / 2}
            r={u * 0.82}
            fill="#f6f8ef"
            stroke={ink}
            strokeWidth={u * 0.12}
          />
          <text
            x={l / 2}
            y={w / 2}
            dy=".34em"
            textAnchor="middle"
            fontSize={u * 0.93}
            fill={ink}
          >
            {number}
          </text>
        </g>
      )}
      {selected && (
        <rect
          x={-u * 0.3}
          y={-u * 0.3}
          width={l + u * 0.6}
          height={w + u * 0.6}
          rx={u * 0.22}
          stroke="#bd502f"
          strokeWidth={u * 0.45}
          fill="none"
          strokeDasharray={u * 1.1 + ' ' + u * 0.5}
          pointerEvents="none"
        />
      )}
    </g>
  );
}

export default function PlanDrawing({
  project,
  layer = 'interior',
  selected = null,
  onSelect,
  onMove,
  labels = true,
  grid = false,
  snap = 25,
  numbered = false,
  preview = false,
  svgRef,
}) {
  const patternId = 'plan-grid-' + useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const { length: L, width: W } = envelope(project.vehicle);
  const bounds = drawingBounds(project.vehicle);
  const u = bounds.k * 0.022,
    font = bounds.k * (preview ? 0.061 : 0.045);
  const rootRef = useRef(null),
    drag = useRef(null);
  const [pending, setPending] = React.useState(null);
  const items = (project.items || [])
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => isVisible(item, layer))
    .sort(
      (a, b) =>
        Number(a.item.id === selected) - Number(b.item.id === selected) ||
        Number(isOpening(a.item)) - Number(isOpening(b.item)) ||
        a.item.z - b.item.z,
    );
  const coords = (e) => {
    const svg = rootRef.current,
      matrix = svg?.getScreenCTM();
    if (!svg || !matrix) return null;
    const p = svg.createSVGPoint();
    p.x = e.clientX;
    p.y = e.clientY;
    const pt = p.matrixTransform(matrix.inverse());
    return { x: pt.x, y: W - pt.y };
  };
  const down = (e, item) => {
    if (e.button !== 0 || !onSelect) return;
    e.preventDefault();
    e.stopPropagation();
    onSelect(item.id);
    const p = coords(e);
    if (!p || !onMove) return;
    drag.current = { id: item.id, item, p, pointer: e.pointerId };
    rootRef.current.setPointerCapture?.(e.pointerId);
  };
  const position = (e) => {
    const d = drag.current,
      p = coords(e);
    if (!d || d.pointer !== e.pointerId || !p) return null;
    const dx = p.x - d.p.x,
      dy = p.y - d.p.y;
    if (Math.abs(dx) + Math.abs(dy) < 1) return null;
    const next = clampPosition(
      d.item,
      d.item.x + dx,
      d.item.y + dy,
      project.vehicle,
      snap,
    );
    if (isOpening(d.item)) {
      if (['left', 'right'].includes(d.item.side)) next.y = d.item.y;
      else next.x = d.item.x;
    }
    return { id: d.id, ...next };
  };
  const end = (e) => {
    if (!drag.current || drag.current.pointer !== e.pointerId) return;
    const next = position(e);
    drag.current = null;
    setPending(null);
    if (next) onMove?.(next);
  };
  const item = project.items?.find((part) => part.id === selected);
  const path = item && extractionPath(item, project.items);
  const horizontalY = -bounds.k * 0.103,
    verticalX = L + bounds.k * 0.095;
  const lineStyle = { stroke: '#69776b', strokeWidth: u * 0.18, fill: 'none' };
  return (
    <svg
      ref={(el) => {
        rootRef.current = el;
        if (svgRef) svgRef.current = el;
      }}
      xmlns="http://www.w3.org/2000/svg"
      width="100%"
      height="100%"
      viewBox={[bounds.x, bounds.y, bounds.width, bounds.height].join(' ')}
      role={onSelect ? 'group' : 'img'}
      aria-label={
        'Grundriss mit Innenmaß ' +
        formatMM(L) +
        ' mal ' +
        formatMM(W) +
        ' Millimeter'
      }
      onPointerMove={(e) => {
        if (drag.current) setPending(position(e));
      }}
      onPointerUp={end}
      onPointerCancel={() => {
        drag.current = null;
        setPending(null);
      }}
      style={{
        display: 'block',
        userSelect: 'none',
        fontFamily: 'DM Sans, Arial, sans-serif',
      }}
    >
      <title>{project.name + ' · bemaßter Grundriss'}</title>
      <defs>
        <pattern
          id={patternId}
          width="100"
          height="100"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M 100 0 H 0 V 100"
            stroke="#bbc4b3"
            strokeWidth={u * 0.13}
            fill="none"
          />
        </pattern>
      </defs>
      <Cabin length={L} width={W} cab={bounds.cab} unit={u} />
      {grid && <rect width={L} height={W} fill={'url(#' + patternId + ')'} />}
      <g {...lineStyle}>
        <path
          d={
            'M 0 ' +
            -u * 1.0 +
            ' V ' +
            (horizontalY - u * 0.62) +
            ' M ' +
            L +
            ' ' +
            -u * 1.0 +
            ' V ' +
            (horizontalY - u * 0.62) +
            ' M 0 ' +
            horizontalY +
            ' H ' +
            L
          }
        />
        <path
          d={
            'M ' +
            (L + u * 1.05) +
            ' 0 H ' +
            (verticalX + u * 0.6) +
            ' M ' +
            (L + u * 1.05) +
            ' ' +
            W +
            ' H ' +
            (verticalX + u * 0.6) +
            ' M ' +
            verticalX +
            ' 0 V ' +
            W
          }
        />
        <path
          d={
            'M ' +
            -u * 0.48 +
            ' ' +
            (horizontalY + u * 0.48) +
            ' l ' +
            u * 0.96 +
            ' ' +
            -u * 0.96 +
            ' M ' +
            (L - u * 0.48) +
            ' ' +
            (horizontalY + u * 0.48) +
            ' l ' +
            u * 0.96 +
            ' ' +
            -u * 0.96 +
            ' M ' +
            (verticalX - u * 0.48) +
            ' ' +
            u * 0.48 +
            ' l ' +
            u * 0.96 +
            ' ' +
            -u * 0.96 +
            ' M ' +
            (verticalX - u * 0.48) +
            ' ' +
            (W + u * 0.48) +
            ' l ' +
            u * 0.96 +
            ' ' +
            -u * 0.96
          }
        />
      </g>
      <g
        className="layout-dimensions"
        fontFamily="monospace"
        fontSize={font}
        fill="#425448"
        textAnchor="middle"
        fontWeight="600"
      >
        <text x={L / 2} y={horizontalY - u * 0.55}>
          {formatMM(L)} mm
        </text>
        <text
          transform={
            'translate(' +
            (verticalX + u * 1.85) +
            ',' +
            W / 2 +
            ') rotate(-90)'
          }
        >
          {formatMM(W)} mm
        </text>
      </g>
      {items.map(({ item, index }) => (
        <Part
          key={item.id}
          item={pending?.id === item.id ? { ...item, ...pending } : item}
          roomWidth={W}
          unit={u}
          selected={selected === item.id}
          interactive={!!onSelect}
          onPointerDown={down}
          onSelect={onSelect}
          labels={labels}
          number={numbered ? String(index + 1) : null}
        />
      ))}
      {path && layer !== 'roof' && (
        <rect
          x={path.corridor.x}
          y={W - path.corridor.y - path.corridor.width}
          width={path.corridor.length}
          height={path.corridor.width}
          fill="#f7cb8c"
          fillOpacity=".55"
          stroke="#ab793d"
          strokeWidth={u * 0.22}
          strokeDasharray={u * 0.7 + ' ' + u * 0.4}
          pointerEvents="none"
        />
      )}
    </svg>
  );
}
