'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertTriangle, Copy, Check } from 'lucide-react';
import { ApiError, toFriendlyMessage } from '@ledger/utils';
import { useCreateTenant } from '@/api/hooks/use-tenants';
import { Button, Input, PageHeader, Spinner, toast } from '@ledger/ui';

const schema = z.object({
  name: z.string().min(1, 'Tenant name is required'),
  webhookUrl: z.string().url('Enter a valid URL').optional().or(z.literal('')),
});

type FormValues = z.infer<typeof schema>;

export default function NewTenantPage() {
  const router = useRouter();
  const { mutate, isPending } = useCreateTenant();
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', webhookUrl: '' },
  });

  async function handleCopy() {
    if (!apiKey) return;
    await navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function onSubmit(values: FormValues) {
    mutate(
      { name: values.name, webhookUrl: values.webhookUrl || undefined },
      {
        onSuccess: ({ apiKey: key }) => {
          toast.success('Tenant created successfully.');
          setApiKey(key);
        },
        onError: (error) => {
          if (error instanceof ApiError && error.correlationId) {
            setError('root', {
              message: `${toFriendlyMessage(error)} (Ref: ${error.correlationId})`,
            });
          } else {
            setError('root', { message: toFriendlyMessage(error) });
          }
        },
      },
    );
  }

    if (apiKey) {
      return (
        <div className="max-w-md space-y-5">
          <PageHeader title="Tenant Created" />

          <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <p>
              <strong>Copy this API key now.</strong> It is shown only once and cannot be retrieved
              again. Give it to the tenant to use in their application.
            </p>
          </div>

          <div className="bg-muted flex items-center gap-2 rounded-md border px-3 py-2.5">
            <code className="flex-1 font-mono text-xs break-all select-all">{apiKey}</code>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={handleCopy}
              aria-label="Copy API key"
            >
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>

          <Button onClick={() => router.push('/tenants')}>Done — Back to Tenants</Button>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <PageHeader title="New Tenant" />

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="bg-card max-w-md space-y-4 rounded-xl border p-6 shadow-sm"
        >
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

          <div className="space-y-1">
            <label htmlFor="webhook" className="text-sm font-medium">
              Webhook URL <span className="text-muted-foreground">(optional)</span>
            </label>
            <Input
              id="webhook"
              type="url"
              placeholder="https://example.com/webhook"
              aria-invalid={!!errors.webhookUrl}
              aria-describedby={errors.webhookUrl ? 'webhook-error' : undefined}
              {...register('webhookUrl')}
            />
            {errors.webhookUrl && (
              <p id="webhook-error" className="text-destructive text-sm">
                {errors.webhookUrl.message}
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
            {isPending ? 'Creating…' : 'Create Tenant'}
          </Button>
        </form>
      </div>
    );
}
