import { ART_KEYS } from '../artKeys.js'

const NAVY = '#0b2a50'
const PINK = '#fd3f92'
const BACKGROUNDS = { lavender: '#eef1f8', peach: '#fff0f6', mint: '#e9f6f3', blue: '#e8f0fb' }
const line = { stroke: NAVY, strokeWidth: 3, strokeLinejoin: 'round', strokeLinecap: 'round' }

const shapes = {
  vitamin: () => (<>
    <rect x="52" y="58" width="56" height="72" rx="10" fill="#fff" {...line} />
    <rect x="58" y="38" width="44" height="22" rx="5" fill={NAVY} />
    <rect x="60" y="78" width="40" height="30" rx="4" fill={PINK} />
    <path d="M80 84v18M71 93h18" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
  </>),
  vitaminc: () => (<>
    <rect x="38" y="68" width="84" height="62" rx="12" fill="#fff" {...line} />
    <rect x="44" y="46" width="72" height="24" rx="6" fill={PINK} />
    <rect x="50" y="84" width="60" height="30" rx="4" fill={NAVY} />
    <circle cx="80" cy="99" r="7" fill="#fff" />
  </>),
  cleanser: () => (<>
    <rect x="56" y="64" width="48" height="68" rx="12" fill="#fff" {...line} />
    <rect x="74" y="38" width="12" height="28" fill={NAVY} />
    <rect x="72" y="32" width="32" height="10" rx="5" fill={NAVY} />
    <rect x="60" y="86" width="40" height="22" rx="4" fill={PINK} />
  </>),
  firstaid: () => (<>
    <rect x="30" y="58" width="100" height="68" rx="10" fill="#fff" {...line} />
    <path d="M64 58v-8a6 6 0 0 1 6-6h20a6 6 0 0 1 6 6v8" fill="none" {...line} />
    <rect x="74" y="74" width="12" height="36" rx="2" fill={PINK} />
    <rect x="62" y="86" width="36" height="12" rx="2" fill={PINK} />
  </>),
  omega: () => (<>
    <rect x="42" y="72" width="76" height="58" rx="10" fill="#fff" {...line} />
    <rect x="38" y="52" width="84" height="24" rx="8" fill={NAVY} />
    <rect x="50" y="88" width="60" height="28" rx="4" fill={PINK} />
    <circle cx="80" cy="102" r="8" fill="#fff" />
  </>),
  device: () => (
    <g transform="rotate(-35 80 80)">
      <rect x="68" y="20" width="24" height="108" rx="12" fill="#fff" {...line} />
      <rect x="73" y="40" width="14" height="26" rx="3" fill={PINK} />
      <circle cx="80" cy="112" r="7" fill={NAVY} />
    </g>
  ),
  medicine: () => (<>
    <rect x="38" y="58" width="84" height="64" rx="6" fill="#fff" {...line} />
    <rect x="38" y="58" width="84" height="20" rx="6" fill={NAVY} />
    <path d="M80 88v22M69 99h22" stroke={PINK} strokeWidth="6" strokeLinecap="round" />
  </>),
  tube: () => (<>
    <path d="M62 40h36l4 78a4 4 0 0 1-4 4H62a4 4 0 0 1-4-4z" fill="#fff" {...line} />
    <rect x="60" y="30" width="40" height="12" rx="3" fill={NAVY} />
    <rect x="62" y="124" width="36" height="12" rx="3" fill={NAVY} />
    <rect x="62" y="68" width="36" height="26" fill={PINK} />
  </>),
  sachet: () => (<>
    <rect x="46" y="44" width="68" height="88" rx="4" fill="#fff" {...line} />
    <path d="M46 52h68M46 124h68" stroke={NAVY} strokeWidth="3" strokeDasharray="4 4" />
    <circle cx="80" cy="88" r="16" fill={PINK} />
    <path d="M80 80v16M72 88h16" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
  </>),
  strip: () => (<>
    <rect x="30" y="54" width="100" height="52" rx="8" fill="#fff" {...line} />
    {[0, 1, 2, 3].map((i) => <circle key={`a${i}`} cx={48 + i * 22} cy="70" r="7" fill={PINK} />)}
    {[0, 1, 2, 3].map((i) => <circle key={`b${i}`} cx={48 + i * 22} cy="92" r="7" fill={PINK} opacity=".55" />)}
  </>),
  dropper: () => (<>
    <rect x="54" y="74" width="52" height="56" rx="10" fill="#fff" {...line} />
    <rect x="68" y="60" width="24" height="16" fill={NAVY} />
    <ellipse cx="80" cy="42" rx="11" ry="20" fill={PINK} />
    <rect x="62" y="92" width="36" height="20" rx="3" fill={NAVY} />
  </>),
  spray: () => (<>
    <rect x="56" y="72" width="48" height="58" rx="10" fill="#fff" {...line} />
    <rect x="72" y="52" width="16" height="22" fill={NAVY} />
    <rect x="68" y="38" width="42" height="14" rx="6" fill={PINK} />
    <rect x="62" y="92" width="36" height="20" rx="3" fill={NAVY} />
  </>),
  jar: () => (<>
    <rect x="40" y="76" width="80" height="54" rx="14" fill="#fff" {...line} />
    <rect x="36" y="56" width="88" height="24" rx="8" fill={NAVY} />
    <rect x="50" y="92" width="60" height="24" rx="4" fill={PINK} />
  </>),
  box: () => (<>
    <rect x="36" y="48" width="88" height="82" rx="6" fill="#fff" {...line} />
    <rect x="36" y="48" width="22" height="82" rx="6" fill={NAVY} />
    <rect x="68" y="66" width="46" height="8" rx="4" fill={PINK} />
    <rect x="68" y="84" width="34" height="6" rx="3" fill={NAVY} opacity=".35" />
    <rect x="68" y="98" width="40" height="6" rx="3" fill={NAVY} opacity=".35" />
  </>),
}

export default function ProductArt({ type, color = 'lavender', imageUrl, name = '', className = '' }) {
  if (imageUrl) {
    return (
      <div className={`product-art has-photo ${className}`.trim()}>
        <img src={imageUrl} alt={name} loading="lazy" />
      </div>
    )
  }
  const Shape = shapes[ART_KEYS.includes(type) ? type : 'vitamin']
  return (
    <div className={`product-art ${className}`.trim()} style={{ background: BACKGROUNDS[color] || BACKGROUNDS.lavender }}>
      <svg viewBox="0 0 160 160" role="img" aria-label={name || 'Product illustration'}>
        <ellipse cx="80" cy="140" rx="36" ry="5" fill={NAVY} opacity=".08" />
        <Shape />
      </svg>
    </div>
  )
}
