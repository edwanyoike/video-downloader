'use client';

import { useState, useEffect, useRef } from 'react';

interface ProgressBarProps {
  jobId: string;
  apiBase: string;
}

interface ProgressData {
  stage: 'queued' | 'downloading' | 'merging' | 'complete' | 'error';
  percent: number;
  eta?: number;
  speed?: string;
  message?: string;
  fileReady?: boolean;
}

export function ProgressBar({ jobId, apiBase }: ProgressBarProps) {
  const [progress, setProgress] = useState<ProgressData>({
    stage: 'queued',
    percent: 0,
  });
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource(`${apiBase}/api/jobs/${jobId}/progress`);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data: ProgressData = JSON.parse(event.data);
        setProgress(data);

        if (data.stage === 'complete' && data.fileReady) {
          es.close();
          // Trigger file download
          window.location.href = `${apiBase}/api/jobs/${jobId}/file`;
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
      <div className="p-4 border border-red-200 bg-red-50 rounded-lg">
        <p className="text-red-700 text-sm">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-2 text-sm text-blue-600 hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 border rounded-lg bg-gray-50">
      <div className="flex justify-between text-sm mb-2">
        <span className="text-gray-600">{stageLabel[progress.stage] || progress.stage}</span>
        <span className="font-medium">{Math.round(progress.percent)}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2.5">
        <div
          className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
          style={{ width: `${Math.min(100, progress.percent)}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-gray-400 mt-1">
        {progress.speed && <span>{progress.speed}</span>}
        {progress.eta !== undefined && progress.eta > 0 && (
          <span>~{progress.eta}s remaining</span>
        )}
      </div>
    </div>
  );
}
