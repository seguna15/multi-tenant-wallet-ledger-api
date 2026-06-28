'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertTriangle, Copy, Check, RefreshCw } from 'lucide-react';
import { ApiError, toFriendlyMessage } from '@ledger/utils';
import { useMyTenant, useRotateWebhookSecret, useUpdateTenant } from '@/api/hooks/use-tenant';
import { Button, Input, PageHeader, Spinner, toast } from '@ledger/ui';
import { COPY } from '@/constants/copy';

const schema = z.object({
  webhookUrl: z.string().url('Enter a valid URL').optional().or(z.literal('')),
});

type FormValues = z.infer<typeof schema>;

export default function WebhooksPage() {
  const { data: tenant } = useMyTenant();
  const {
    mutate: rotateSecret,
    isPending: isRotating,
    error: rotateError,
  } = useRotateWebhookSecret();
  const { mutate: updateTenant, isPending: isSaving, isSuccess } = useUpdateTenant();
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { webhookUrl: '' },
  });

  useEffect(() => {
    if (tenant) reset({ webhookUrl: tenant.webhookUrl ?? '' });
  }, [tenant, reset]);

  async function handleCopy() {
    if (!newSecret) return;
    await navigator.clipboard.writeText(newSecret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

   function onSubmit(values: FormValues) {
     updateTenant(
       { webhookUrl: values.webhookUrl || undefined },
       {
         onSuccess: () => toast.success('Webhook URL saved.'),
         onError: (error) => {
           toast.error('Failed to save webhook URL', toFriendlyMessage(error));
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


  return (
    <div className="space-y-6">
      <PageHeader title="Webhooks" />

      <div className="bg-card space-y-4 rounded-xl border p-6 shadow-sm">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="space-y-1">
            <label htmlFor="webhookUrl" className="text-sm font-medium">
              Webhook URL
            </label>
            <div className="flex items-start gap-2">
              <Input
                id="webhookUrl"
                type="url"
                placeholder="https://example.com/webhook"
                aria-invalid={!!errors.webhookUrl}
                aria-describedby={errors.webhookUrl ? 'webhook-url-error' : undefined}
                {...register('webhookUrl')}
              />
              <Button type="submit" disabled={isSaving}>
                {isSaving ? <Spinner className="mr-2 h-4 w-4" /> : null}
                {isSaving ? 'Saving…' : 'Save'}
              </Button>
            </div>
            {errors.webhookUrl && (
              <p id="webhook-url-error" className="text-destructive text-sm">
                {errors.webhookUrl.message}
              </p>
            )}
          </div>

          {errors.root && (
            <p role="alert" className="text-destructive text-sm">
              {errors.root.message}
            </p>
          )}
        </form>
      </div>

      <div className="bg-card space-y-4 rounded-xl border p-6 shadow-sm">
        <p className="text-sm font-medium">Webhook Secret</p>

        {rotateError && (
          <p className="text-destructive text-sm">
            {rotateError instanceof ApiError && rotateError.correlationId
              ? `${toFriendlyMessage(rotateError)} (Ref: ${rotateError.correlationId})`
              : toFriendlyMessage(rotateError)}
          </p>
        )}

        {newSecret ? (
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <p>
                <strong>Shown only once.</strong> Update your webhook handler before closing.
              </p>
            </div>
            <div className="bg-muted flex items-center gap-2 rounded-md border px-3 py-2.5">
              <code className="flex-1 font-mono text-xs break-all select-all">{newSecret}</code>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={handleCopy}
                aria-label="Copy webhook secret"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <Button variant="outline" onClick={() => setNewSecret(null)}>
              Done
            </Button>
          </div>
        ) : confirming ? (
          <div className="flex items-center gap-3">
            <p className="text-muted-foreground text-sm">{COPY.webhooks.rotateConfirm}</p>
            <Button
              variant="destructive"
              size="sm"
              disabled={isRotating}
              onClick={() =>
                rotateSecret(undefined, {
                  onSuccess: ({ webhookSecret }) => {
                    toast.success('Webhook secret rotated.');
                    setNewSecret(webhookSecret);
                    setConfirming(false);
                  },
                  onError: (error) =>
                    toast.error('Failed to rotate webhook secret', toFriendlyMessage(error)),
                })
              }
            >
              {isRotating ? 'Rotating…' : 'Yes, rotate'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            variant="destructive"
            disabled={!tenant?.webhookUrl}
            onClick={() => setConfirming(true)}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Rotate Webhook Secret
          </Button>
        )}
      </div>
    </div>
  );
}
