import React from 'react';
import { MAP_PLACES } from '@/constants/game/places';
import type { PlaceId } from '@/types/gameType';

/** Lược đồ Đại Việt thời Trần (minh họa, không theo tỉ lệ) */
export const SchematicMap: React.FC<{
  pins?: PlaceId[];
  labels?: PlaceId[];
  selectable?: PlaceId[];
  selected?: PlaceId | null;
  correct?: PlaceId | null;
  wrong?: PlaceId | null;
  highlight?: PlaceId | null;
  routes?: Array<{ path: string; enemy?: boolean }>;
  onSelect?: (id: PlaceId) => void;
  dark?: boolean;
  className?: string;
  title?: string;
}> = ({ pins = [], labels, selectable = [], selected = null, correct = null, wrong = null, highlight = null, routes = [], onSelect, dark = false, className = '', title = 'Lược đồ Đại Việt thời Trần' }) => {
  const gid = React.useId().replace(/:/g, '');
  const land = dark ? '#1e2a3d' : '#f1e5c7';
  const land2 = dark ? '#243349' : '#e9d9b2';
  const sea = dark ? '#0e2238' : '#cfe8f1';
  const river = dark ? '#3b82a6' : '#6cb9d8';
  const ink = dark ? '#e7dcc4' : '#3b2a1a';
  const shown = new Set<PlaceId>([...pins, ...selectable]);
  const labelSet = new Set<PlaceId>(labels ?? [...shown]);
  const coast =
    'M0 0 H440 V150 C428 160 412 176 400 186 C386 196 372 204 360 214 C350 226 342 240 330 252 C318 264 304 274 296 284 C286 298 280 312 274 322 C264 338 254 352 246 366 C236 384 228 400 222 418 C216 438 216 458 224 474 C232 490 240 506 248 520 H0 Z';
  return (
    <svg viewBox="0 0 440 520" className={className} role="img" aria-label={title}>
      <defs>
        <marker id={`a-${gid}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 Z" fill="#b91c1c" />
        </marker>
        <marker id={`b-${gid}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 Z" fill="#0f766e" />
        </marker>
        <pattern id={`s-${gid}`} width="40" height="22" patternUnits="userSpaceOnUse">
          <path d="M0 14 q10 -8 20 0 t20 0" fill="none" stroke={dark ? '#1c3a57' : '#b5dbe8'} strokeWidth="1.6" />
        </pattern>
      </defs>
      <rect width="440" height="520" fill={sea} />
      <rect width="440" height="520" fill={`url(#s-${gid})`} />
      <path d={coast} fill={land} stroke={dark ? '#4b5d78' : '#c9b588'} strokeWidth="2" />
      <path d="M0 0 H200 C170 60 120 110 60 140 C40 150 20 156 0 160 Z" fill={land2} opacity="0.8" />
      {[
        [404, 206, 9, 4],
        [418, 220, 7, 3.5],
        [396, 224, 6, 3],
      ].map(([x, y, rx, ry]) => (
        <ellipse key={`${x}-${y}`} cx={x} cy={y} rx={rx} ry={ry} fill={land} stroke={dark ? '#4b5d78' : '#c9b588'} strokeWidth="1.5" />
      ))}
      <g fill="none" stroke={river} strokeLinecap="round">
        <path d="M18 40 C70 90 120 140 160 180 C176 196 186 212 192 228 C206 262 228 292 266 330" strokeWidth="5" />
        <path d="M190 200 C210 190 228 180 246 176" strokeWidth="3.5" />
        <path d="M246 176 C262 184 274 192 286 200 C304 214 320 228 340 246" strokeWidth="4" />
        <path d="M282 128 C270 145 258 160 248 174" strokeWidth="3" />
        <path d="M112 384 C150 394 182 408 216 422" strokeWidth="3.5" />
      </g>
      <g fill={dark ? '#3a4a68' : '#c8b07c'} stroke={dark ? '#56698a' : '#a68d55'} strokeWidth="1.5" strokeLinejoin="round">
        {[
          [96, 92],
          [126, 70],
          [58, 128],
          [318, 150],
          [300, 88],
          [80, 300],
          [110, 250],
        ].map(([x, y]) => (
          <path key={`${x}-${y}`} d={`M${x - 12} ${y + 8} L${x} ${y - 10} L${x + 12} ${y + 8} Z`} />
        ))}
      </g>
      {routes.map((r, i) => (
        <path
          key={i}
          d={r.path}
          fill="none"
          stroke={r.enemy ? '#b91c1c' : '#0f766e'}
          strokeWidth="3"
          strokeDasharray="8 6"
          strokeLinecap="round"
          markerEnd={`url(#${r.enemy ? 'a' : 'b'}-${gid})`}
          opacity="0.9"
        />
      ))}
      {[...shown].map((id) => {
        const p = MAP_PLACES[id];
        const isSel = selected === id;
        const isOk = correct === id;
        const isBad = wrong === id;
        const isHi = highlight === id;
        const pickable = selectable.includes(id) && !!onSelect;
        const fill = isOk ? '#0f766e' : isBad ? '#b91c1c' : isSel ? '#d97706' : isHi ? '#b91c1c' : dark ? '#e7dcc4' : '#3b2a1a';
        const anchor = p.anchor ?? 'start';
        const tx = anchor === 'end' ? p.x - 11 : anchor === 'middle' ? p.x : p.x + 11;
        return (
          <g
            key={id}
            role={pickable ? 'button' : undefined}
            tabIndex={pickable ? 0 : undefined}
            aria-label={pickable ? `Chọn ${p.name}` : undefined}
            aria-pressed={pickable ? isSel : undefined}
            onClick={pickable ? () => onSelect?.(id) : undefined}
            onKeyDown={
              pickable
                ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelect?.(id);
                    }
                  }
                : undefined
            }
            style={pickable ? { cursor: 'pointer' } : undefined}
          >
            {pickable && <circle cx={p.x} cy={p.y} r="22" fill="transparent" />}
            {(isSel || isHi || isOk || isBad) && <circle cx={p.x} cy={p.y} r="13" fill={fill} opacity="0.22" />}
            <circle cx={p.x} cy={p.y} r={pickable ? 8 : 6} fill={fill} stroke={dark ? '#0b1220' : '#fffdf7'} strokeWidth="2.5" />
            {labelSet.has(id) && (
              <text
                x={tx}
                y={p.y + 4 + (p.dy ?? 0)}
                textAnchor={anchor}
                fontSize="13"
                fontWeight="700"
                fill={ink}
                stroke={dark ? '#0b1220' : '#fffdf7'}
                strokeWidth="3.5"
                paintOrder="stroke"
                style={{ fontFamily: 'var(--font-sans)' }}
              >
                {p.name}
              </text>
            )}
          </g>
        );
      })}
      <text x="12" y="508" fontSize="11" fill={ink} opacity="0.75" style={{ fontFamily: 'var(--font-sans)' }}>
        Lược đồ minh họa – không theo tỉ lệ
      </text>
      <g transform="translate(410 470)" fill={ink} opacity="0.8">
        <path d="M0 -18 L5 0 L0 -4 L-5 0 Z" />
        <text y="14" textAnchor="middle" fontSize="11" fontWeight="700" style={{ fontFamily: 'var(--font-sans)' }}>
          B
        </text>
      </g>
    </svg>
  );
};
