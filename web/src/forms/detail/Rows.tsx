// 详情各层共用的「标签 — 值」行：空值整行隐藏，可复制的值右侧带复制图标。
import type {ReactNode} from 'react';
import {CopyButton} from '../../components/CopyButton';

export type Row = {label: string; value: ReactNode; copy?: string} | false | null | undefined | '';

export function Rows({rows}: {rows: Row[]}) {
  const list = rows.filter((x): x is Exclude<Row, false | null | undefined | ''> => !!x);
  if (!list.length) return null;
  return <dl className="detail-grid">
    {list.map(row => <div key={row.label}>
      <dt>{row.label}</dt>
      <dd className={row.copy ? 'has-copy' : undefined}>
        {row.value}{row.copy ? <CopyButton text={row.copy} label={`复制${row.label}`}/> : null}
      </dd>
    </div>)}
  </dl>;
}
