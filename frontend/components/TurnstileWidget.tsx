'use client';

import { useRef, useEffect, useImperativeHandle, forwardRef, useCallback } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          'error-callback'?: () => void;
          'expired-callback'?: () => void;
          size?: 'invisible' | 'normal' | 'compact';
        },
      ) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

export interface TurnstileHandle {
  getToken: () => Promise<string>;
}

export const TurnstileWidget = forwardRef<TurnstileHandle>(function TurnstileWidget(_props, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const resolveRef = useRef<((token: string) => void) | null>(null);

  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '';

  const renderWidget = useCallback(() => {
    if (!window.turnstile || !containerRef.current || widgetIdRef.current) return;

    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      size: 'invisible',
      callback: (token: string) => {
        if (resolveRef.current) {
          resolveRef.current(token);
          resolveRef.current = null;
        }
      },
      'error-callback': () => {
        if (resolveRef.current) {
          resolveRef.current('');
          resolveRef.current = null;
        }
      },
      'expired-callback': () => {
        // Token expired — will be re-requested on next getToken call
      },
    });
  }, [siteKey]);

  useEffect(() => {
    // Turnstile script may already be loaded
    if (window.turnstile) {
      renderWidget();
    } else {
      // Wait for the script to load
      const interval = setInterval(() => {
        if (window.turnstile) {
          clearInterval(interval);
          renderWidget();
        }
      }, 100);
      return () => clearInterval(interval);
    }
  }, [renderWidget]);

  useImperativeHandle(ref, () => ({
    getToken: () => {
      return new Promise<string>((resolve) => {
        if (widgetIdRef.current && window.turnstile) {
          // Reset to get a fresh token
          window.turnstile.reset(widgetIdRef.current);
        }
        resolveRef.current = resolve;

        // If turnstile isn't loaded yet, resolve with empty string
        setTimeout(() => {
          if (resolveRef.current) {
            resolveRef.current('');
            resolveRef.current = null;
          }
        }, 10_000);
      });
    },
  }));

  return <div ref={containerRef} />;
});
