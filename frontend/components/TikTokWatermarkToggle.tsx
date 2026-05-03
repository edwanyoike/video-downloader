'use client';

import { useState } from 'react';

interface TikTokWatermarkToggleProps {
  onChange: (noWatermark: boolean) => void;
}

export function TikTokWatermarkToggle({ onChange }: TikTokWatermarkToggleProps) {
  const [noWatermark, setNoWatermark] = useState(false);

  const handleToggle = () => {
    const next = !noWatermark;
    setNoWatermark(next);
    onChange(next);
  };

  return (
    <div className="p-3 border rounded-lg bg-gray-50">
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={noWatermark}
          onChange={handleToggle}
          className="rounded"
        />
        <span className="text-sm font-medium">Remove TikTok watermark</span>
      </label>
      {noWatermark && (
        <p className="text-xs text-gray-400 mt-1">
          Attempts to download without the TikTok watermark. May not work for all videos.
        </p>
      )}
    </div>
  );
}
