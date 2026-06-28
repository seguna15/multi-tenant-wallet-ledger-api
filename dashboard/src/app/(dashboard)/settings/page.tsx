'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ApiError, toFriendlyMessage } from '@ledger/utils';
import { useMyTenant, useUpdateTenant } from '@/api/hooks/use-tenant';
import { Button, Input, PageHeader, Spinner, toast } from '@ledger/ui';

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
});

type FormValues = z.infer<typeof schema>;

export default function SettingsPage() {
  const { data: tenant } = useMyTenant();
  const { mutate, isPending } = useUpdateTenant();

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '' },
  });

  useEffect(() => {
    if (tenant) reset({ name: tenant.name });
  }, [tenant, reset]);

    function onSubmit(values: FormValues) {
      mutate(values, {
        onSuccess: () => toast.success('Settings saved successfully.'),
        onError: (error) => {
          toast.error('Failed to save settings', toFriendlyMessage(error));
          if (error instanceof ApiError && error.correlationId) {
            setError('root', {
              message: `${toFriendlyMessage(error)} (Ref: ${error.correlationId})`,
            });
          } else {
            setError('root', { message: toFriendlyMessage(error) });
          }
        },
      });
    }

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" />

      <div className="bg-card max-w-md rounded-xl border p-6 shadow-sm">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="name" className="text-sm font-medium">
              Tenant Name
            </label>
            <Input
              id="name"
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? 'name-error' : undefined}
              {...register('name')}
            />
            {errors.name && (
              <p id="name-error" className="text-destructive text-sm">
                {errors.name.message}
              </p>
            )}
          </div>

          {errors.root && (
            <p role="alert" className="text-destructive text-sm">
              {errors.root.message}
            </p>
          )}

          <Button type="submit" disabled={isPending}>
            {isPending ? <Spinner className="mr-2 h-4 w-4" /> : null}
            {isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </form>
      </div>
    </div>
  );
}
