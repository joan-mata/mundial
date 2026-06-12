'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface Item { id: string; label: string }
interface Props { items: Item[] }

export function ContestReorder({ items: initialItems }: Props) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [saving, setSaving] = useState(false);

  async function move(idx: number, dir: -1 | 1) {
    const next = [...items];
    const swap = idx + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    setItems(next);
    setSaving(true);
    await fetch('/api/admin/team-picks', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: next.map(x => x.id) }),
    });
    setSaving(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-1">
      {items.map((item, i) => (
        <div key={item.id} className="flex items-center gap-2">
          <button
            onClick={() => move(i, -1)}
            disabled={i === 0 || saving}
            className="text-xs px-1 py-0.5 rounded border hover:bg-accent disabled:opacity-30 disabled:cursor-default transition-colors"
          >↑</button>
          <button
            onClick={() => move(i, 1)}
            disabled={i === items.length - 1 || saving}
            className="text-xs px-1 py-0.5 rounded border hover:bg-accent disabled:opacity-30 disabled:cursor-default transition-colors"
          >↓</button>
          <span className="text-xs text-muted-foreground w-4">{i + 1}.</span>
          <span className="text-sm">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
