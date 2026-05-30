export type VerifyStatus = 'idle' | 'loading' | 'success' | 'error';

export interface AuthStore {
  verifyStatus: VerifyStatus;
  verifyMessage: string | null;
  verifyEmailToken: (token: string) => Promise<void>;
  resetVerifyStatus: () => void;
}