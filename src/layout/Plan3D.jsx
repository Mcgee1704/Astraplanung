import React from 'react';
import { envelope, formatMM, isOpening, isVisible } from './geometry.js';
import { materials, ObjectDetail } from './PlanDrawing.jsx';

const rad = (degree) => (degree * Math.PI) / 180;
const toPoints = (points) => points.map((p) => p.join(',')).join(' ');

export default function Plan3D({
  project,
  selected,
  onSelect,
  layer,
  angle,
  elevation,
  labels = true,
}) {
  const area = envelope(project.vehicle);
  const c = Math.cos(rad(angle)),
    s = Math.sin(rad(angle)),
    v = Math.sin(rad(elevation)),
    h = Math.cos(rad(elevation));
  const point = (x, y, z) => [x * c + y * s, (x * s - y * c) * v - z * h];
  const depth = (x, y, z) => (x * s - y * c) * h + z * v;
  const corners = (x, y, z, l, w) =>
    [
      [x, y, z],
      [x + l, y, z],
      [x + l, y + w, z],
      [x, y + w, z],
    ].map((p) => point(...p));
  const outside = [
    ...corners(0, 0, 0, area.length, area.width),
    ...corners(0, 0, area.height, area.length, area.width),
  ];
  const shown = (project.items || [])
    .filter((item) => isVisible(item, layer))
    .sort(
      (a, b) =>
        depth(a.x + a.length * 0.5, a.y + a.width * 0.5, a.z + a.height * 0.5) -
        depth(b.x + b.length * 0.5, b.y + b.width * 0.5, b.z + b.height * 0.5),
    );
  const all = [
    ...outside,
    ...shown.flatMap((i) => [
      ...corners(i.x, i.y, i.z, i.length, i.width),
      ...corners(i.x, i.y, i.z + i.height, i.length, i.width),
    ]),
  ];
  const pad = Math.max(90, area.width * 0.09),
    minX = Math.min(...all.map((p) => p[0])) - pad,
    minY = Math.min(...all.map((p) => p[1])) - pad;
  const vb = [
    minX,
    minY,
    Math.max(...all.map((p) => p[0])) - minX + pad,
    Math.max(...all.map((p) => p[1])) - minY + pad,
  ];
  const u = Math.max(area.width, area.length * 0.39) * 0.021;
  const line = (a, b, props, key) => (
    <line key={key} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} {...props} />
  );
  const base = corners(0, 0, 0, area.length, area.width),
    top = corners(0, 0, area.height, area.length, area.width);
  const backStyle = {
    stroke: '#a7b4a2',
    strokeWidth: u * 0.16,
    strokeDasharray: u * 0.8 + ' ' + u * 0.55,
  };
  const blueprint = { stroke: '#b9c3ad', strokeWidth: u * 0.14 };
  const floorGrid = [];
  const gridStep = Math.max(
    500,
    Math.ceil(Math.max(area.width, area.length) / 40 / 100) * 100,
  );
  for (let x = gridStep; x < area.length; x += gridStep)
    floorGrid.push(
      line(point(x, 0, 0), point(x, area.width, 0), blueprint, 'x' + x),
    );
  for (let y = gridStep; y < area.width; y += gridStep)
    floorGrid.push(
      line(point(0, y, 0), point(area.length, y, 0), blueprint, 'y' + y),
    );
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      role="group"
      aria-label="Räumliches Modell der aktuellen Bauteile"
      viewBox={vb.join(' ')}
      width="100%"
      height="100%"
      style={{ display: 'block', fontFamily: 'DM Sans, Arial, sans-serif' }}
    >
      <polygon
        points={toPoints(base)}
        fill="#edeada"
        stroke="#697864"
        strokeWidth={u * 0.33}
      />
      {floorGrid}
      {base.map((p, i) => line(p, top[i], backStyle, 'post' + i))}
      <polygon points={toPoints(top)} fill="none" {...backStyle} />
      {shown.map((item) => {
        const { x, y, z, length: l, width: w, height: t } = item;
        const b = corners(x, y, z, l, w),
          a = corners(x, y, z + t, l, w);
        const [fill, ink] = materials[item.kind] || materials.custom;
        const xSide = s >= 0 ? [1, 2] : [3, 0],
          ySide = c <= 0 ? [2, 3] : [0, 1];
        const face = (i, j) => toPoints([b[i], b[j], a[j], a[i]]);
        const [tx, ty] = point(x, y, z + t),
          center = point(x + l * 0.5, y + w * 0.5, z + t);
        return (
          <g
            key={item.id}
            data-layout-item={item.id}
            role="button"
            tabIndex="0"
            aria-label={item.name + ' auswählen'}
            onClick={() => onSelect(item.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(item.id);
              }
            }}
            style={{ cursor: 'pointer' }}
            strokeLinejoin="round"
          >
            <title>{item.name + ' · Höhe ' + formatMM(t) + ' mm'}</title>
            <g
              fill={fill}
              stroke={selected === item.id ? '#ad5034' : ink}
              strokeWidth={u * (selected === item.id ? 0.44 : 0.23)}
              fillOpacity={isOpening(item) ? 0.5 : 1}
            >
              <polygon points={face(...xSide)} />
              <polygon
                points={face(...xSide)}
                fill="#36452e"
                fillOpacity=".19"
                stroke="none"
              />
              <polygon points={face(...ySide)} />
              <polygon
                points={face(...ySide)}
                fill="#465c42"
                fillOpacity=".09"
                stroke="none"
              />
              <polygon points={toPoints(a)} />
            </g>
            <g
              transform={
                'matrix(' + [c, s * v, s, -c * v, tx, ty].join(' ') + ')'
              }
              pointerEvents="none"
            >
              <ObjectDetail item={item} unit={u} ink={ink} />
            </g>
            {selected === item.id && labels && (
              <text
                x={center[0]}
                y={center[1] - u * 0.3}
                fontSize={u * 1.65}
                fontWeight="700"
                textAnchor="middle"
                fill="#373e32"
                style={{
                  paintOrder: 'stroke',
                  stroke: '#f7f2df',
                  strokeWidth: u * 0.22,
                }}
              >
                {item.name}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
