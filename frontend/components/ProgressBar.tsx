'use client';

import { useState, useEffect, useRef } from 'react';

interface ProgressBarProps {
  jobId: string;
  apiBase: string;
  platformColor?: string;
}

interface ProgressData {
  stage: 'queued' | 'downloading' | 'merging' | 'complete' | 'error';
  percent: number;
  eta?: number;
  speed?: string;
  message?: string;
  fileReady?: boolean;
}

export function ProgressBar({ jobId, apiBase, platformColor }: ProgressBarProps) {
  const color = platformColor || '#10b981';
  const [progress, setProgress] = useState<ProgressData>({
    stage: 'queued',
    percent: 0,
  });
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource(`${apiBase}/api/jobs/${jobId}/progress`);
    eventSourceRef.current = es;

    es.onmessage = async (event) => {
      try {
        const data: ProgressData = JSON.parse(event.data);
        setProgress(data);

        if (data.stage === 'complete' && data.fileReady) {
          es.close();
          // Verify file is available before triggering download
          try {
            const check = await fetch(`${apiBase}/api/jobs/${jobId}/file`, { method: 'HEAD' });
            if (check.ok) {
              const a = document.createElement('a');
              a.href = `${apiBase}/api/jobs/${jobId}/file`;
              a.download = '';
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
            } else {
              setError('File not available. It may have expired. Please retry.');
            }
          } catch {
            setError('Failed to download file. Please retry.');
          }
        }

        if (data.stage === 'error') {
          es.close();
          setError(data.message || 'Download failed. Please retry.');
        }
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      es.close();
      setError('Connection lost. Please retry.');
    };

    return () => {
      es.close();
    };
  }, [jobId, apiBase]);

  const stageLabel: Record<string, string> = {
    queued: 'Waiting in queue...',
    downloading: 'Downloading...',
    merging: 'Merging audio & video...',
    complete: 'Complete!',
    error: 'Failed',
  };

  if (error) {
    return (
      <div className="p-3 rounded-xl border border-red-500/30 bg-red-500/10">
        <p className="text-red-400 text-sm">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-2 text-sm font-semibold text-emerald-400 hover:text-emerald-300"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div
      className="p-3 rounded-xl border"
      style={{ borderColor: `${color}30`, backgroundColor: `${color}08` }}
    >
      <div className="flex justify-between text-sm mb-2">
        <span className="text-gray-200 font-medium">
          {stageLabel[progress.stage] || progress.stage}
        </span>
        <span className="font-bold" style={{ color }}>
          {Math.round(progress.percent)}%
        </span>
      </div>
      <div className="w-full bg-gray-800 rounded-full h-2">
        <div
          className="h-2 rounded-full transition-all duration-300"
          style={{
            width: `${Math.min(100, progress.percent)}%`,
            backgroundColor: color,
            boxShadow: `0 0 8px ${color}40`,
          }}
        />
      </div>
      {(progress.speed || (progress.eta !== undefined && progress.eta > 0)) && (
        <div className="flex justify-between text-xs text-gray-400 mt-1.5">
          {progress.speed && <span>{progress.speed}</span>}
          {progress.eta !== undefined && progress.eta > 0 && (
            <span>~{progress.eta}s remaining</span>
          )}
        </div>
      )}
    </div>
  );
}
