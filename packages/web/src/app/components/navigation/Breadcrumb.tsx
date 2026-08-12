import Link from 'next/link';
import type { ReactNode } from 'react';

export interface BreadcrumbItem {
  label: string;
  href?: string | null;
  icon?: ReactNode;
  suffix?: ReactNode;
}

export function HomeBreadcrumbIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="m3.5 10.5 8.5-7 8.5 7" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.5 9.5v10h13v-10M9.5 19.5v-5h5v5" />
    </svg>
  );
}

function Crumb({ item, current }: { item: BreadcrumbItem; current: boolean }) {
  const content = <span className="block max-w-[min(14rem,42vw)] truncate" title={item.label}>{item.label}</span>;
  if (!current && item.href) return <Link href={item.href} className="min-w-0 shrink truncate transition-colors hover:text-slate-900">{content}</Link>;
  return <span aria-current={current ? 'page' : undefined} className={`inline-flex min-w-0 shrink items-center gap-1.5 ${current ? 'font-semibold text-slate-900' : ''}`}>{content}{item.suffix}</span>;
}

function HomeCrumb({ item }: { item: BreadcrumbItem }) {
  const link = item.href ? <Link href={item.href} aria-label={item.label} title={item.label} className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-indigo-500 transition-colors hover:text-indigo-700">{item.icon ?? <HomeBreadcrumbIcon />}<span className="sr-only">{item.label}</span></Link> : <span aria-label={item.label} title={item.label} className="flex h-5 w-5 shrink-0 items-center justify-center text-indigo-500">{item.icon ?? <HomeBreadcrumbIcon />}<span className="sr-only">{item.label}</span></span>;
  return link;
}

export function ResponsiveBreadcrumb({ items, ariaLabel = 'Breadcrumb' }: { items: readonly BreadcrumbItem[]; ariaLabel?: string }) {
  const current = items[items.length - 1];
  const previous = items.length > 2 ? items[items.length - 2] : null;

  return (
    <nav aria-label={ariaLabel} className="min-w-0 max-w-full overflow-hidden text-xs font-medium text-slate-400">
      <ol className="hidden min-w-0 items-center gap-2 lg:flex">
        {items.map((item, index) => <li key={`${item.label}-${index}`} className="flex min-w-0 shrink items-center gap-2">{index === 0 ? <HomeCrumb item={item} /> : <><span aria-hidden="true" className="shrink-0 text-slate-400">/</span><Crumb item={item} current={index === items.length - 1} /></>}</li>)}
      </ol>
      <ol className="flex min-w-0 items-center gap-2 lg:hidden">
        <li className="flex min-w-0 shrink items-center gap-2"><HomeCrumb item={items[0] ?? { label: 'Home', href: '/' }} /></li>
        {items.length > 2 && <li aria-hidden="true" className="shrink-0 text-slate-400">/</li>}
        {items.length > 3 && <li className="shrink-0 text-slate-500" title="Livelli intermedi nascosti">…</li>}
        {previous && previous !== items[0] && <li className="flex min-w-0 shrink items-center gap-2"><span aria-hidden="true" className="shrink-0 text-slate-400">/</span><Crumb item={previous} current={previous === current} /></li>}
        {current && current !== items[0] && <li className="flex min-w-0 shrink items-center gap-2"><span aria-hidden="true" className="shrink-0 text-slate-400">/</span><Crumb item={current} current /></li>}
      </ol>
    </nav>
  );
}
