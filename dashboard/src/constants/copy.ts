export const COPY = {
  tenants: {
    statusActive: 'Active',
    statusInactive: 'Inactive',
  },
  webhooks: {
    rotateConfirm: 'Current secret invalidated immediately. Continue?',
  },
  apiKeys: {
    description:
      'Your API key is not stored in a retrievable form. Rotate it to generate a new one — the new key is shown once in the confirmation modal.',
  },
} as const;

export const API_KEY_COPY = {
  rotateButton: 'Rotate',
  rotateDialog: {
    title: 'Rotate API key',
    description:
      'This will invalidate the current key immediately. Any integrations using it will stop working until updated.',
    confirm: 'Confirm rotation',
    cancel: 'Cancel',
  },
  revealDialog: {
    title: 'New API key',
    description:
      'Copy this key now — for security, it will be masked after you close this dialog and cannot be shown again.',
    copyButton: 'Copy',
    doneButton: 'Done',
  },
} as const;
