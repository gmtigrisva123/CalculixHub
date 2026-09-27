import React from 'react';

export default function NumericAnswerGrid({ digits, value, onChange, disabled }: {
  digits: number; value: string; onChange: (value: string) => void; disabled: boolean;
}) {
  const selected = value.padEnd(digits, '_').split('');
  return <fieldset disabled={disabled} className="space-y-3">
    <legend className="text-sm text-content-muted">Select one digit in each column. Include leading zeros.</legend>
    <div className="flex gap-2 overflow-x-auto pb-2">
      {Array.from({ length: digits }, (_, column) => <div key={column} className="min-w-12 flex-1 space-y-1">
        <div className="text-center font-mono text-lg border-b border-line pb-2">{selected[column] === '_' ? '—' : selected[column]}</div>
        <div role="group" aria-label={'Digit ' + (column + 1)}>
          {Array.from({ length: 10 }, (_, digit) => <button
            key={digit} type="button" aria-label={'Column ' + (column + 1) + ', digit ' + digit}
            aria-pressed={selected[column] === String(digit)}
            className={'block w-full min-h-11 my-1 rounded-full border font-mono transition-colors ' + (selected[column] === String(digit) ? 'border-indigo-500 bg-indigo-500/20 text-indigo-500' : 'border-line text-content hover:bg-surface-sunken')}
            onClick={() => { const next = [...selected]; next[column] = String(digit); onChange(next.join('')); }}
          >{digit}</button>)}
        </div>
      </div>)}
    </div>
  </fieldset>;
}
