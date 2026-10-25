import { useMemo } from 'react';
import MathText from '../MathText';

// The segments MathText renders as math. Blocks never split inside one.
const SEGMENT = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|\$([^$\n]+?)\$|\\begin\{([a-z*]+)\}([\s\S]+?)\\end\{\5\}/g;

type Block =
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'table'; head: string[] | null; rows: string[][] }
  | { type: 'rule' };

/** Split on blank lines that sit outside math, so a display equation is never cut in two. */
function chunks(source: string): string[] {
  const out: string[] = [];
  let current = '';
  let last = 0;
  const addText = (text: string) => {
    text.split(/\n[ \t]*\n+/).forEach((part, index) => {
      if (index > 0) { out.push(current); current = ''; }
      current += part;
    });
  };
  for (const match of source.matchAll(SEGMENT)) {
    addText(source.slice(last, match.index));
    current += match[0];
    last = (match.index ?? 0) + match[0].length;
  }
  addText(source.slice(last));
  out.push(current);
  return out.map(chunk => chunk.trim()).filter(Boolean);
}

/** Split a table row on the pipes that are not inside math ($|x|$ stays whole). */
function cells(row: string): string[] {
  const bars: number[] = [];
  let last = 0;
  const scan = (from: number, to: number) => {
    for (let i = from; i < to; i += 1) if (row[i] === '|') bars.push(i);
  };
  for (const match of row.matchAll(SEGMENT)) {
    scan(last, match.index ?? 0);
    last = (match.index ?? 0) + match[0].length;
  }
  scan(last, row.length);
  const out: string[] = [];
  for (let i = 0; i + 1 < bars.length; i += 1) out.push(row.slice(bars[i] + 1, bars[i + 1]).trim());
  return out;
}

const BULLET = /^(?:[-•*])\s+/;

function parse(source: string): Block[] {
  const blocks: Block[] = [];
  for (const chunk of chunks(source)) {
    if (/^(?:-{3,}|\*{3,}|_{3,})$/.test(chunk)) { blocks.push({ type: 'rule' }); continue; }
    const lines = chunk.split('\n');
    if (lines.length > 1 && lines.every(line => /^\|.*\|$/.test(line.trim()))) {
      const rows = lines.map(line => cells(line.trim()));
      const alignAt = rows.findIndex(row => row.length > 0 && row.every(cell => /^:?-{3,}:?$/.test(cell)));
      const head = alignAt === 1 ? rows[0] : null;
      blocks.push({ type: 'table', head, rows: rows.filter((_, index) => index !== alignAt && !(head && index === 0)) });
      continue;
    }
    // Bulleted lines become a list; any lines around them stay paragraphs.
    let paragraph: string[] = [];
    let items: string[] = [];
    const flushParagraph = () => { if (paragraph.length) blocks.push({ type: 'paragraph', text: paragraph.join('\n') }); paragraph = []; };
    const flushItems = () => { if (items.length) blocks.push({ type: 'list', items }); items = []; };
    for (const line of lines) {
      if (BULLET.test(line) && !/^\*\*/.test(line)) {
        flushParagraph();
        items.push(line.replace(BULLET, ''));
      } else if (items.length && /^\s{2,}\S/.test(line)) {
        items[items.length - 1] += `\n${line.trim()}`;
      } else {
        flushItems();
        paragraph.push(line);
      }
    }
    flushParagraph();
    flushItems();
  }
  return blocks;
}

/** Answer choices are set at display size, so a fraction reads like the one in the problem. */
export function displayMath(text: string): string {
  return text.replace(/(?<!\\)\$([^$\n]+?)\$/g, (_, inner: string) => `$\\displaystyle ${inner}$`);
}

/**
 * Problem statements and reference solutions, typeset as prose: paragraphs, lists and the
 * occasional table, with every formula rendered by the app's MathText.
 */
export default function ArchiveProse({ text, className }: { text: string; className?: string }) {
  const blocks = useMemo(() => parse(text), [text]);
  return <div className={className ? `xa-prose ${className}` : 'xa-prose'}>
    {blocks.map((block, index) => {
      if (block.type === 'rule') return <hr key={index} />;
      if (block.type === 'list') return <ul key={index}>{block.items.map((item, itemIndex) => <li key={itemIndex}><MathText text={item} /></li>)}</ul>;
      if (block.type === 'table') return <div key={index} className="xa-prose-table" role="region" aria-label="Table" tabIndex={0}>
        <table>
          {block.head && <thead><tr>{block.head.map((cell, cellIndex) => <th key={cellIndex} scope="col"><MathText text={cell} /></th>)}</tr></thead>}
          <tbody>{block.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}><MathText text={cell} /></td>)}</tr>)}</tbody>
        </table>
      </div>;
      return <p key={index}><MathText text={block.text} /></p>;
    })}
  </div>;
}
