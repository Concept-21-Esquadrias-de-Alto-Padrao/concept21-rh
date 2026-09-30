"use client";

import type { ReactNode } from "react";
import { useState } from "react";

interface TabItem {
  id: string;
  label: string;
  content: ReactNode;
}

interface TabsProps {
  tabs: TabItem[];
  defaultTab?: string;
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
}

export function Tabs({ tabs, defaultTab, activeTab: controlledActiveTab, onTabChange }: TabsProps) {
  const [internalActiveTab, setInternalActiveTab] = useState(defaultTab ?? tabs[0]?.id);
  const activeTab = controlledActiveTab ?? internalActiveTab;
  const active = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];

  function selectTab(tabId: string) {
    if (!controlledActiveTab) {
      setInternalActiveTab(tabId);
    }

    onTabChange?.(tabId);
  }

  return (
    <div>
      <div className="mb-4 overflow-x-auto border-b border-zinc-200">
        <div className="flex min-w-max gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => selectTab(tab.id)}
              className={`border-b-2 px-4 py-3 text-sm font-medium transition ${
                active?.id === tab.id
                  ? "border-[#f97316] text-[#f97316]"
                  : "border-transparent text-zinc-500 hover:text-zinc-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      <div>{active?.content}</div>
    </div>
  );
}
