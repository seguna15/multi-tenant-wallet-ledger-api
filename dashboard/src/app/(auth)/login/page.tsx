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
    router.replace('/');
  }

  return (
    <AuthLoginCard
      title="Dashboard"
      subtitle="Sign in to manage your tenant"
      isPending={isPending}
      onSubmit={onSubmit}
    />
  );
}
