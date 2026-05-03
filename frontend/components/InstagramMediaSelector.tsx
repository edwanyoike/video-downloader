'use client';

import { useState } from 'react';
import type { MediaInfo } from '@/lib/types';

interface InstagramMediaSelectorProps {
  items: MediaInfo[];
  onSelect: (selected: MediaInfo[]) => void;
}

export function InstagramMediaSelector({ items, onSelect }: InstagramMediaSelectorProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(items.map((i) => i.id)));

  const toggleItem = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      onSelect(items.filter((i) => next.has(i.id)));
      return next;
    });
  };

  const selectAll = () => {
    const all = new Set(items.map((i) => i.id));
    setSelectedIds(all);
    onSelect(items);
  };

  const selectNone = () => {
    setSelectedIds(new Set());
    onSelect([]);
  };

  if (items.length <= 1) return null;

  return (
    <div className="p-3 border rounded-lg bg-gray-50">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium">
          Select media ({selectedIds.size}/{items.length})
        </span>
        <div className="flex gap-2 text-xs">
          <button onClick={selectAll} className="text-blue-600 hover:underline">
            All
          </button>
          <button onClick={selectNone} className="text-blue-600 hover:underline">
            None
          </button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => toggleItem(item.id)}
            className={`relative rounded-lg overflow-hidden border-2 transition-colors ${
              selectedIds.has(item.id) ? 'border-blue-500' : 'border-transparent'
            }`}
          >
            {item.thumbnailUrl && (
              <img
                src={item.thumbnailUrl}
                alt={item.title}
                className="w-full h-20 object-cover"
              />
            )}
            {selectedIds.has(item.id) && (
              <div className="absolute top-1 right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                <span className="text-white text-xs">✓</span>
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
