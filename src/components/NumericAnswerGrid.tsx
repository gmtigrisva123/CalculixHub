import React from 'react';

/*
 * One row for each digit of the answer: the digit chosen so far, then 0 to 9 in
 * two short lines. Rows keep a three-digit answer about 300px tall on a phone,
 * so the submit button stays within reach of the question.
 */
export default function NumericAnswerGrid({ digits, value, onChange, disabled }: {
  digits: number; value: string; onChange: (value: string) => void; disabled: boolean;
}) {
  const selected = value.padEnd(digits, '_').split('');
  return <fieldset disabled={disabled} className="space-y-3">
    <legend className="text-sm text-content-muted">Pick one digit in each row. Include leading zeros.</legend>
    <div className="grid gap-3">
      {Array.from({ length: digits }, (_, column) => <div key={column} className="grid grid-cols-[2.25rem_minmax(0,1fr)] items-center gap-2">
        <div className="text-center font-mono text-lg">{selected[column] === '_' ? '·' : selected[column]}</div>
        <div role="group" aria-label={'Digit ' + (column + 1)} className="grid grid-cols-5 gap-1">
          {Array.from({ length: 10 }, (_, digit) => <button
            key={digit} type="button" aria-label={'Column ' + (column + 1) + ', digit ' + digit}
            aria-pressed={selected[column] === String(digit)}
            className={'min-h-11 lg:min-h-9 rounded-[10px] border font-mono text-[15px] transition-colors ' + (selected[column] === String(digit) ? 'border-accent bg-accent-muted text-accent-text font-semibold' : 'border-line text-content hover:bg-surface-sunken')}
            onClick={() => { const next = [...selected]; next[column] = String(digit); onChange(next.join('')); }}
          >{digit}</button>)}
        </div>
      </div>)}
    </div>
  </fieldset>;
}
