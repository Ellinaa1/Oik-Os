import { create } from 'zustand';
import { verifyEmailApi } from '@/api/auth.api';
import type { AuthStore } from '@/pages/verifiemail/VerifyEmailPage.types';

export const useVerifyEmailStore = create<AuthStore>((set) => ({
  verifyStatus: 'idle',
  verifyMessage: null,

  verifyEmailToken: async (token: string) => {
    set({ verifyStatus: 'loading', verifyMessage: null });
    
    try {
      await verifyEmailApi(token);
      set({ 
        verifyStatus: 'success', 
        verifyMessage: 'Email verified! Continue to setup →' 
      });
    } catch (error) {
      set({ 
        verifyStatus: 'error', 
        verifyMessage: 'Link expired. Request a new one' 
      });
    }
  },

  resetVerifyStatus: () => {
    set({ verifyStatus: 'idle', verifyMessage: null });
  }
}));