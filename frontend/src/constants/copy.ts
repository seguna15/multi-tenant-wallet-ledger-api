export const COPY = {
  transfers: {
    formTitle: 'New Transfer',
    unresolvedAccount: 'Account number not found',
    transferFormDescription: "Send funds using the recipient's account number.",
  },
  wallets: {
    emptyState: "You don't have any wallets yet.",
    emptyStateDescription: 'Create your first wallet to start sending and receiving funds.',
  },
} as const;


export const TRANSFER_FORM_COPY = {
  title: 'Send a transfer',
  recipientLabel: 'Recipient account',
  amountLabel: 'Amount',
  descriptionLabel: 'Description (optional)',
  submitButton: 'Send transfer',
  errors: {
    recipientRequired: 'Recipient account is required',
    amountDecimals: 'Amount can have at most 2 decimal places',
    amountTooLow: 'Amount must be greater than 0',
    amountTooHigh: 'Amount exceeds maximum transfer limit',
    selfTransfer: 'Cannot transfer to the same account',
  },
} as const;

export const PAGINATION_COPY = {
  previous: 'Previous',
  next: 'Next',
  pageOf: (page: number, total: number) => `Page ${page} of ${total}`,
} as const;

