import * as React from 'react';
import { cn } from '@/lib/utils';

function PageHeader({ className, children, ...props }: React.ComponentProps<'section'>) {
  return (
    <section
      className={cn(
        'mx-auto flex max-w-[1080px] flex-col items-center gap-2 py-12 text-center md:py-20',
        className,
      )}
      {...props}
    >
      {children}
    </section>
  );
}

function PageHeaderHeading({ className, ...props }: React.ComponentProps<'h1'>) {
  return (
    <h1
      className={cn(
        'text-balance text-5xl font-bold leading-[1.1] tracking-tighter sm:text-6xl md:text-8xl lg:text-9xl',
        className,
      )}
      {...props}
    />
  );
}

function PageHeaderDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p
      className={cn(
        'text-balance max-w-[750px] text-base text-muted-foreground sm:text-lg',
        className,
      )}
      {...props}
    />
  );
}

function PageActions({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('flex w-full flex-wrap items-center justify-center gap-4 pt-8', className)}
      {...props}
    />
  );
}

export { PageHeader, PageHeaderHeading, PageHeaderDescription, PageActions };
