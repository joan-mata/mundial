'use client';
import { useState } from 'react';
import { Input } from './input';

interface Team { id: string; name: string; flag: string; }

interface Props {
  teams: Team[];
  selected: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}

export function TeamCheckboxSelect({ teams, selected, onChange, disabled }: Props) {
  const [query, setQuery] = useState('');
  const selectedSet = new Set(selected);

  const filtered = teams.filter(t =>
    t.name.toLowerCase().includes(query.toLowerCase()) ||
    t.id.toLowerCase().includes(query.toLowerCase())
  );

  function toggle(id: string) {
    if (disabled) return;
    const next = new Set(selectedSet);
    if (next.has(id)) next.delete(id); else next.add(id);
    onChange(Array.from(next));
  }

  return (
    <div className="rounded-md border">
      <div className="p-2 border-b">
        <Input
          placeholder="Buscar equipo…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="h-8 text-sm"
          disabled={disabled}
        />
      </div>
      <div className="max-h-52 overflow-y-auto divide-y">
        {filtered.length === 0 ? (
          <p className="px-3 py-2 text-sm text-muted-foreground">Sin resultados</p>
        ) : filtered.map(t => (
          <label
            key={t.id}
            className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-accent transition-colors text-sm ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <input
              type="checkbox"
              checked={selectedSet.has(t.id)}
              onChange={() => toggle(t.id)}
              disabled={disabled}
              className="rounded"
            />
            <span>{t.flag}</span>
            <span className={selectedSet.has(t.id) ? 'font-medium' : ''}>{t.name}</span>
            <span className="ml-auto text-xs text-muted-foreground">{t.id}</span>
          </label>
        ))}
      </div>
      <div className="px-3 py-1.5 border-t text-xs text-muted-foreground bg-muted/30">
        {selected.length} seleccionados
      </div>
    </div>
  );
}
