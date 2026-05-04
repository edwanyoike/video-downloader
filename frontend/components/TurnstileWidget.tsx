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

  // If no site key, expose a getToken that returns empty string immediately
  useImperativeHandle(ref, () => ({
    getToken: () => {
      if (!siteKey) return Promise.resolve('');
      return new Promise<string>((resolve) => {
        if (widgetIdRef.current && window.turnstile) {
          window.turnstile.reset(widgetIdRef.current);
        }
        resolveRef.current = resolve;
        setTimeout(() => {
          if (resolveRef.current) {
            resolveRef.current('');
            resolveRef.current = null;
          }
        }, 10_000);
      });
    },
  }));

  const renderWidget = useCallback(() => {
    if (!siteKey || !window.turnstile || !containerRef.current || widgetIdRef.current) return;

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

  if (!siteKey) return <div ref={containerRef} />;

  return <div ref={containerRef} />;
});
