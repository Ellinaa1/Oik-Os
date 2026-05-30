export const verifyEmailApi = async (token: string): Promise<void> => {
  const response = await fetch(`/api/v1/auth/verify?token=${token}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Verification failed');
  }

  return response.json();
};