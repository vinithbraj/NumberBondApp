interface KeypadProps {
  disabled: boolean
  canSubmit: boolean
  onDigit: (digit: string) => void
  onBackspace: () => void
  onSubmit: () => void
}

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

export function Keypad({
  disabled,
  canSubmit,
  onDigit,
  onBackspace,
  onSubmit,
}: KeypadProps) {
  return (
    <div className="keypad" aria-label="Number keypad">
      {DIGITS.map((digit) => (
        <button
          className="keypad__key"
          disabled={disabled}
          key={digit}
          type="button"
          onClick={() => onDigit(digit)}
        >
          {digit}
        </button>
      ))}
      <button
        className="keypad__key keypad__key--action"
        disabled={disabled}
        type="button"
        aria-label="Backspace"
        onClick={onBackspace}
      >
        <span aria-hidden="true">⌫</span>
      </button>
      <button
        className="keypad__key"
        disabled={disabled}
        type="button"
        onClick={() => onDigit('0')}
      >
        0
      </button>
      <button
        className="keypad__key keypad__key--check"
        disabled={disabled || !canSubmit}
        type="button"
        onClick={onSubmit}
      >
        Check
      </button>
    </div>
  )
}
