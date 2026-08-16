import React, { createContext, useContext, useMemo } from 'react';
import { useAgency } from '@/contexts/AgencyContext';
import { createPrivacyAnonymizer, type PrivacyAnonymizer } from '@/lib/privacyDemoAnonymizer';

export type { PrivacyAnonymizer };

interface PrivacyDemoContextValue {
  isActive: boolean;
  anonymizer: PrivacyAnonymizer;
}

const PrivacyDemoContext = createContext<PrivacyDemoContextValue | null>(null);

export function PrivacyDemoProvider({ children }: { children: React.ReactNode }) {
  const { currentAgency } = useAgency();
  const isActive = Boolean(currentAgency?.settings?.enabledIntegrations?.anonymize_ads_for_video);

  const anonymizer = useMemo(() => createPrivacyAnonymizer(), []);

  const value = useMemo(() => ({ isActive, anonymizer }), [isActive, anonymizer]);

  return <PrivacyDemoContext.Provider value={value}>{children}</PrivacyDemoContext.Provider>;
}

export function usePrivacyDemo(): PrivacyDemoContextValue {
  const ctx = useContext(PrivacyDemoContext);
  if (!ctx) {
    throw new Error('usePrivacyDemo must be used within PrivacyDemoProvider');
  }
  return ctx;
}
