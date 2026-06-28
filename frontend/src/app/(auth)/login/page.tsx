'use client';

import { useRouter } from 'next/navigation';
import { type LoginInput } from '@ledger/utils';
import { useLogin } from '@/api/hooks/use-login';
import { AuthLoginCard } from '@ledger/ui';

export default function LoginPage() {
  const router = useRouter();
  const { mutateAsync: login, isPending } = useLogin();

  async function onSubmit(values: LoginInput) {
    await login(values);
    router.replace('/wallet');
  }

  return <AuthLoginCard title="Sign in" isPending={isPending} onSubmit={onSubmit} />;
}
