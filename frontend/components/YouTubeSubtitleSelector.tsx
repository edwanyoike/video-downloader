'use client';

import { useState } from 'react';
import type { SubtitleTrack } from '@/lib/types';

interface YouTubeSubtitleSelectorProps {
  subtitles: SubtitleTrack[];
  onChange: (lang: string | undefined, format: 'srt' | 'vtt' | undefined) => void;
}

export function YouTubeSubtitleSelector({ subtitles, onChange }: YouTubeSubtitleSelectorProps) {
  const [enabled, setEnabled] = useState(false);
  const [selectedLang, setSelectedLang] = useState(subtitles[0]?.language || '');
  const [selectedFormat, setSelectedFormat] = useState<'srt' | 'vtt'>('srt');

  const handleToggle = () => {
    const next = !enabled;
    setEnabled(next);
    if (next) {
      onChange(selectedLang, selectedFormat);
    } else {
      onChange(undefined, undefined);
    }
  };

  const handleLangChange = (lang: string) => {
    setSelectedLang(lang);
    if (enabled) onChange(lang, selectedFormat);
  };

  const handleFormatChange = (fmt: 'srt' | 'vtt') => {
    setSelectedFormat(fmt);
    if (enabled) onChange(selectedLang, fmt);
  };

  return (
    <div className="p-3 border rounded-lg bg-gray-50">
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={enabled}
          onChange={handleToggle}
          className="rounded"
        />
        <span className="text-sm font-medium">Download subtitles</span>
      </label>

      {enabled && (
        <div className="mt-3 flex gap-3">
          <select
            value={selectedLang}
            onChange={(e) => handleLangChange(e.target.value)}
            className="flex-1 text-sm border rounded px-2 py-1"
          >
            {subtitles.map((s) => (
              <option key={s.language} value={s.language}>
                {s.languageName} ({s.language})
              </option>
            ))}
          </select>

          <select
            value={selectedFormat}
            onChange={(e) => handleFormatChange(e.target.value as 'srt' | 'vtt')}
            className="text-sm border rounded px-2 py-1"
          >
            <option value="srt">SRT</option>
            <option value="vtt">VTT</option>
          </select>
        </div>
      )}
    </div>
  );
}
