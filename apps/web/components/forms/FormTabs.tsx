'use client';

import { Icon } from '@iconify/react';
import { useState, type ReactNode } from 'react';

export type FormTab = {
  id: string;
  label: string;
  icon?: string;
  content: ReactNode;
  disabled?: boolean;
};

export type FormTabsProps = {
  tabs: FormTab[];
  defaultTab?: string;
  onChange?: (tabId: string) => void;
};

export function FormTabs({
  tabs,
  defaultTab,
  onChange,
}: FormTabsProps): React.JSX.Element {
  const [activeId, setActiveId] = useState<string>(
    defaultTab ?? tabs[0]?.id ?? '',
  );

  const handleSelect = (id: string) => {
    if (tabs.find((t) => t.id === id)?.disabled) return;
    setActiveId(id);
    onChange?.(id);
  };

  const active = tabs.find((t) => t.id === activeId);

  return (
    <div>
      <div
        role="tablist"
        className="flex flex-wrap gap-1 border-b border-border"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeId;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              disabled={tab.disabled}
              onClick={() => handleSelect(tab.id)}
              className={[
                '-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-base font-medium transition-colors',
                isActive
                  ? 'border-accent text-accent'
                  : 'border-transparent text-muted hover:text-foreground',
                tab.disabled ? 'cursor-not-allowed opacity-50' : '',
              ].join(' ')}
            >
              {tab.icon ? <Icon icon={tab.icon} className="h-4 w-4" /> : null}
              {tab.label}
            </button>
          );
        })}
      </div>
      <div className="pt-5">{active?.content}</div>
    </div>
  );
}
