'use client';
import * as React from 'react';
import { cn } from '@/lib/utils';

type TabsCtx = { value: string; set: (v: string) => void };
const TabsContext = React.createContext<TabsCtx | null>(null);

export function Tabs(props: { value: string; onValueChange: (v: string) => void } & React.HTMLAttributes<HTMLDivElement>) {
  const { value, onValueChange, ...rest } = props;
  return (
    <TabsContext.Provider value={{ value, set: onValueChange }}>
      <div {...rest} />
    </TabsContext.Provider>
  );
}

export function TabsList(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} />;
}

export function TabsTrigger(
  props: { value: string } & React.ButtonHTMLAttributes<HTMLButtonElement>,
) {
  const ctx = React.useContext(TabsContext)!;
  const { value, className, ...rest } = props;
  const active = ctx.value === value;
  return (
    <button
      {...rest}
      onClick={() => ctx.set(value)}
      className={cn(
        'px-4 py-2 rounded-lg transition-colors',
        active ? 'bg-primary text-primary-foreground' : 'bg-card hover:bg-muted',
        className,
      )}
    />
  );
}

export function TabsContent(props: { value: string } & React.HTMLAttributes<HTMLDivElement>) {
  const ctx = React.useContext(TabsContext)!;
  if (ctx.value !== props.value) return null;
  const { value: _v, ...rest } = props;
  return <div {...rest} />;
}
