export function Frog({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`counting-frog ${className}`}
      viewBox="0 0 140 120"
      fill="none"
      aria-hidden="true"
    >
      <ellipse cx="70" cy="108" rx="46" ry="7" fill="#1c7063" opacity=".14" />
      <ellipse cx="35" cy="93" rx="25" ry="15" fill="#4b9265" />
      <ellipse cx="105" cy="93" rx="25" ry="15" fill="#4b9265" />
      <ellipse cx="70" cy="77" rx="43" ry="33" fill="#76b975" />
      <ellipse cx="70" cy="84" rx="27" ry="23" fill="#d8eab1" />
      <circle cx="43" cy="34" r="22" fill="#76b975" />
      <circle cx="97" cy="34" r="22" fill="#76b975" />
      <ellipse cx="70" cy="52" rx="53" ry="30" fill="#88c982" />
      <circle cx="43" cy="32" r="13" fill="#fffef1" />
      <circle cx="97" cy="32" r="13" fill="#fffef1" />
      <ellipse cx="46" cy="34" rx="5" ry="7" fill="#244d43" />
      <ellipse cx="94" cy="34" rx="5" ry="7" fill="#244d43" />
      <circle cx="48" cy="31" r="2" fill="white" />
      <circle cx="96" cy="31" r="2" fill="white" />
      <ellipse cx="31" cy="56" rx="9" ry="5" fill="#efb8a0" />
      <ellipse cx="109" cy="56" rx="9" ry="5" fill="#efb8a0" />
      <path
        d="M54 56Q70 71 86 56"
        stroke="#315c44"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="m33 84-8 17m82-17 8 17"
        stroke="#4b9265"
        strokeWidth="7"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function CountingPond({
  numbers,
  active = 0,
  missing,
  resolved = false,
  step,
}: {
  numbers: number[]
  active?: number
  missing?: number
  resolved?: boolean
  step: number
}) {
  return (
    <div className="counting-pond">
      <div className="counting-pond__tag">
        <span aria-hidden="true">↗</span> Hop by {step}
      </div>
      <svg
        className="counting-pond__scenery"
        viewBox="0 0 1000 300"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path d="M0 65Q230 10 470 60T1000 35V300H0Z" fill="#d2eee1" />
        <path d="M0 130Q240 40 540 102T1000 98V300H0Z" fill="#bce5da" />
        <path d="M0 176Q230 112 460 156T1000 152V300H0Z" fill="#a8d9d0" />
        <g
          stroke="#eaf9ed"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
          opacity=".8"
        >
          <path d="M40 223h80m700-98h50M530 259h65M220 112h60m590 133h65" />
          <ellipse cx="100" cy="170" rx="22" ry="5" />
          <ellipse cx="830" cy="209" rx="31" ry="6" />
        </g>
        <g stroke="#679c79" strokeWidth="5" strokeLinecap="round">
          <path d="M25 297v-60m0 32-14-16m14 1 15-20m925 63v-77m0 37 16-22m-16 3-10-16" />
        </g>
        <g fill="#f5d3c8">
          <circle cx="931" cy="192" r="8" />
          <circle cx="941" cy="194" r="8" />
          <circle cx="936" cy="185" r="8" />
        </g>
        <circle cx="936" cy="193" r="4" fill="#efb34d" />
      </svg>
      <ol className="counting-pads" aria-label={`Counting by ${step} sequence`}>
        {numbers.map((number, index) => (
          <li
            className={`counting-pad ${index === active ? 'counting-pad--active' : ''} ${index === missing && !resolved ? 'counting-pad--mystery' : ''}`}
            key={index}
          >
            {index === active && (
              <Frog className="counting-pad__frog" key={number} />
            )}
            <span
              className="counting-pad__number"
              aria-label={
                index === missing && !resolved ? 'Missing number' : undefined
              }
            >
              {index === missing && !resolved ? '?' : number}
            </span>
            {index > 0 && (
              <span className="counting-pad__hop" aria-hidden="true">
                +{step}
              </span>
            )}
          </li>
        ))}
      </ol>
      <div className="counting-pond__caption">
        {missing === undefined
          ? 'Little hops. Big discoveries.'
          : 'Every hop adds the same amount.'}
      </div>
    </div>
  )
}

export function CountingGroups({
  step,
  groups,
}: {
  step: number
  groups: number
}) {
  return (
    <div
      className="counting-groups"
      aria-label={`${groups} groups of ${step} make ${groups * step}`}
    >
      {Array.from({ length: 5 }, (_, index) => (
        <div
          className={`counting-group ${index < groups ? 'counting-group--filled' : ''}`}
          key={index}
          aria-hidden="true"
        >
          <div className="counting-group__dots">
            {Array.from({ length: step }, (_, dot) => (
              <i key={dot} />
            ))}
          </div>
          <span>{index < groups ? (index + 1) * step : '·'}</span>
        </div>
      ))}
    </div>
  )
}

export function CountingStars({ earned }: { earned: number }) {
  return (
    <div
      className="counting-stars"
      aria-label={`${earned} of 3 stars collected`}
    >
      {[1, 2, 3].map((star) => (
        <span
          className={star <= earned ? 'is-earned' : ''}
          key={star}
          aria-hidden="true"
        >
          ★
        </span>
      ))}
    </div>
  )
}
