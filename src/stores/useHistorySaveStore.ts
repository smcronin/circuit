import { create } from 'zustand';

export const useHistorySaveStore = create<{
  local: 'loading' | 'saving' | 'saved' | 'error';
  cloud: 'pending' | 'syncing' | 'saved' | 'error';
  message?: string;
}>(() => ({ local: 'loading', cloud: 'pending' }));
