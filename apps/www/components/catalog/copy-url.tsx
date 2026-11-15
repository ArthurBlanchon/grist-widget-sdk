'use client';

import * as React from 'react';
import { CheckIcon, CopyIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** An install URL, with a button that copies it. */
export function CopyUrl({ url, label }: { url: string; label: string }) {
  const [copied, setCopied] = React.useState(false);
  React.useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);
  return (
    <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-1 ps-3">
      <code className="min-w-0 flex-1 truncate text-sm select-all">{url}</code>
      <Button
        size="sm"
        variant="ghost"
        aria-label={copied ? 'Copied' : label}
        onClick={() => {
          navigator.clipboard?.writeText(url).then(() => setCopied(true), () => {});
        }}
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
      </Button>
    </div>
  );
}
