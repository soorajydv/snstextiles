export type JerseyKind = 'tee' | 'polo' | 'vest' | 'hoodie' | 'jacket';

type Props = {
  kind: JerseyKind;
  main: string;
  accent: string;
  trim: string;
  text?: string;
  number?: string;
};

/** Flat illustrated garment used as product artwork until real product photography is available. */
export function JerseyArt({ kind, main, accent, trim, text = '#ffffff', number }: Props) {
  return (
    <svg aria-hidden="true" className="jersey-art" viewBox="0 0 200 200">
      <defs>
        <linearGradient id={`shade-${kind}-${main.slice(1)}`} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".18" />
          <stop offset=".45" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity=".22" />
        </linearGradient>
      </defs>
      <g className="jersey-art-body">{shapes[kind]({ main, accent, trim })}</g>
      <path d={outline[kind]} fill={`url(#shade-${kind}-${main.slice(1)})`} />
      <text fill={text} fontFamily="inherit" fontSize="13" fontWeight="900" letterSpacing="-.5" textAnchor="middle" x={kind === 'vest' ? 118 : 122} y={kind === 'hoodie' ? 86 : 72}>SNS</text>
      {number ? <text fill={text} fontFamily="inherit" fontSize="44" fontWeight="900" letterSpacing="-2" textAnchor="middle" x="100" y="140">{number}</text> : null}
    </svg>
  );
}

type Colors = { main: string; accent: string; trim: string };

const outline: Record<JerseyKind, string> = {
  tee: 'M62 28 80 20q20 14 40 0l18 8 40 26-15 34-19-9v100q-44 7-88 0V79l-19 9-15-34Z',
  polo: 'M62 28 80 20q20 14 40 0l18 8 40 26-15 34-19-9v100q-44 7-88 0V79l-19 9-15-34Z',
  vest: 'M68 18q32 38 64 0l14 4q2 36 18 52v105q-64 9-128 0V74q16-16 18-52Z',
  hoodie: 'M60 44h80l40 28 10 100-22 5-16-72v76q-52 8-104 0v-76l-16 72-22-5 10-100Z',
  jacket: 'M62 30h76l42 28 10 112-22 5-16-74v80q-52 7-104 0v-80l-16 74-22-5 10-112Z',
};

const shapes: Record<JerseyKind, (c: Colors) => React.ReactNode> = {
  tee: ({ main, accent, trim }) => (
    <>
      <path d={outline.tee} fill={main} />
      <path d="M22 54 40 42l12 36-14 8Zm156 0-18-12-12 36 14 8Z" fill={accent} />
      <path d="M56 120 144 64v22l-88 56Z" fill={accent} opacity=".85" />
      <path d="M80 20q20 14 40 0l4 3q-24 22-48 0Z" fill={trim} />
      <path d="M56 176q44 6 88 0" stroke={trim} strokeWidth="4" />
    </>
  ),
  polo: ({ main, accent, trim }) => (
    <>
      <path d={outline.polo} fill={main} />
      <path d="M144 70 56 150v-18l88-80Z" fill={accent} opacity=".8" />
      <path d="M118 70 56 126v-10l62-56Z" fill={accent} opacity=".5" />
      <path d="M22 54 40 42l12 36-14 8Zm156 0-18-12-12 36 14 8Z" fill={trim} opacity=".9" />
      <path d="M80 20q20 10 40 0l6 4-14 14-12-6-12 6-14-14Z" fill={trim} />
      <path d="M100 32v22" stroke={trim} strokeWidth="3" />
    </>
  ),
  vest: ({ main, accent, trim }) => (
    <>
      <path d={outline.vest} fill={main} />
      <path d="M36 74q16-16 18-52l6 2q-2 40-18 56v99l-6-1Z M164 74q-16-16-18-52l-6 2q2 40 18 56v99l6-1Z" fill={accent} />
      <path d="M68 18q32 38 64 0l6 2q-38 46-76 0Z" fill={trim} />
      <path d="M150 90 54 170v-14l96-80Z" fill={accent} opacity=".55" />
    </>
  ),
  hoodie: ({ main, accent, trim }) => (
    <>
      <path d={outline.hoodie} fill={main} />
      <path d="M70 46q2-36 30-36t30 36q-30 16-60 0Z" fill={main} />
      <path d="M76 46q6-24 24-24t24 24q-24 10-48 0Z" fill={accent} opacity=".55" />
      <path d="M92 54v26M108 54v26" stroke={trim} strokeWidth="2.5" />
      <path d="M70 140h60l8 26H62Z" fill={accent} opacity=".45" />
      <path d="M168 170l22-5M10 165l22 5" stroke={trim} strokeWidth="5" />
    </>
  ),
  jacket: ({ main, accent, trim }) => (
    <>
      <path d={outline.jacket} fill={main} />
      <path d="M140 58 180 58l10 112-8 2-12-108Zm-80 0L20 58 10 170l8 2 12-108Z" fill={accent} />
      <path d="M76 30h48l-4 16q-20 6-40 0Z" fill={trim} />
      <path d="M100 46v130" stroke={trim} strokeWidth="2.5" />
      <path d="M58 120h28M114 120h28" stroke={accent} strokeWidth="3" />
    </>
  ),
};
