import type { BondExercise } from '../domain/types'
import { correctAnswer } from '../domain/exerciseGenerator'

interface DotGroupProps {
  count: number
  tone: 'plum' | 'sunny'
  label: string
}

function DotGroup({ count, tone, label }: DotGroupProps) {
  return (
    <div className="dot-group" aria-label={label}>
      {Array.from({ length: count }, (_, index) => (
        <span
          className={`counting-dot counting-dot--${tone}`}
          aria-hidden="true"
          key={index}
        />
      ))}
      {count === 0 && (
        <span className="zero-group" aria-hidden="true">
          0
        </span>
      )}
    </div>
  )
}

export function DotHint({ exercise }: { exercise: BondExercise }) {
  const answer = correctAnswer(exercise)

  if (exercise.missing === 'whole') {
    const [partA, partB] = exercise.parts
    return (
      <aside
        className="dot-hint"
        aria-label={`${partA} dots and ${partB} dots. Count all ${answer} dots.`}
      >
        <p>Count both groups together.</p>
        <div className="dot-hint__groups">
          <DotGroup count={partA} tone="plum" label={`${partA} dots`} />
          <span className="dot-hint__plus" aria-hidden="true">
            +
          </span>
          <DotGroup count={partB} tone="sunny" label={`${partB} dots`} />
        </div>
      </aside>
    )
  }

  const knownPart =
    exercise.missing === 'partA' ? exercise.parts[1] : exercise.parts[0]

  return (
    <aside
      className="dot-hint"
      aria-label={`The whole has ${exercise.whole} dots. ${knownPart} are in the known part. Count the ${answer} sunny dots left for the missing part.`}
    >
      <p>Count the sunny dots for the missing part.</p>
      <div className="dot-hint__groups">
        <DotGroup
          count={knownPart}
          tone="plum"
          label={`${knownPart} dots in the known part`}
        />
        <DotGroup
          count={answer}
          tone="sunny"
          label={`${answer} dots in the missing part`}
        />
      </div>
    </aside>
  )
}
