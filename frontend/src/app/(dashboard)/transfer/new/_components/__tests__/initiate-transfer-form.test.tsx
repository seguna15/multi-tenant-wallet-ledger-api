// Tests for InitiateTransferForm (the "send money" form on /transfer/new).
//
// The form combines three pieces of remote state:
//  - useMyWallets()        — the source wallet picker options
//  - useResolveWallet()    — resolves the typed destination account number
//                             (debounced) to a wallet, or errors if unknown
//  - useCreateTransfer()   — submits the transfer
//
// All three are mocked so each test can drive the form's derived state
// (resolved / self-transfer / cross-currency / submitting) directly, without
// depending on the 500ms debounce timer or a real API.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InitiateTransferForm } from '../initiate-transfer-form';
import { useMyWallets } from '@/api/hooks/use-wallet';
import { useCreateTransfer, useResolveWallet } from '@/api/hooks/use-transfer';

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock('@/api/hooks/use-wallet', () => ({
  useMyWallets: vi.fn(),
}));

vi.mock('@/api/hooks/use-transfer', () => ({
  useCreateTransfer: vi.fn(),
  useResolveWallet: vi.fn(),
}));

// walletFromId is validated with z.string().uuid(), so fixtures must be
// well-formed UUIDs or the "Select a source wallet" error never clears.
const SOURCE_WALLET_ID = '11111111-1111-4111-8111-111111111111';
const DEST_WALLET_ID = '22222222-2222-4222-8222-222222222222';

const SOURCE_WALLET = {
  id: SOURCE_WALLET_ID,
  accountNumber: 'TN-aaaa-0000000001',
  currency: 'USD',
  isActive: true,
  userId: 'user-1',
  tenantId: 'tenant-1',
  createdAt: '2024-01-01T00:00:00.000Z',
};

const mutateMock = vi.fn();

// Default mocks shared by every test — individual tests override the
// useResolveWallet return value to drive the "resolved" / "self-transfer" /
// "not resolved" states.
beforeEach(() => {
  vi.clearAllMocks();

  vi.mocked(useMyWallets).mockReturnValue({
    data: { items: [SOURCE_WALLET], nextCursor: null },
    isLoading: false,
  } as unknown as ReturnType<typeof useMyWallets>);

  vi.mocked(useCreateTransfer).mockReturnValue({
    mutate: mutateMock,
    isPending: false,
  } as unknown as ReturnType<typeof useCreateTransfer>);

  vi.mocked(useResolveWallet).mockReturnValue({
    data: undefined,
    isFetching: false,
    isError: false,
  } as unknown as ReturnType<typeof useResolveWallet>);
});

async function selectSourceWallet() {
  const user = userEvent.setup();
  await user.click(screen.getByRole('combobox'));
  await user.click(await screen.findByRole('option', { name: /USD · TN-aaaa-0000000001/i }));
  return user;
}

describe('InitiateTransferForm', () => {
  it('disables submit until the destination account resolves', async () => {
    render(<InitiateTransferForm />);

    // Nothing has been entered yet — useResolveWallet has no data, so the
    // form can't possibly know where to send the money.
    expect(screen.getByRole('button', { name: /send transfer/i })).toBeDisabled();
    expect(mutateMock).not.toHaveBeenCalled();
  });

  it('rejects amounts with more than 2 decimal places', async () => {
    const user = userEvent.setup();
    render(<InitiateTransferForm />);

    const amountInput = screen.getByLabelText(/^amount/i);
    await user.type(amountInput, '10.999');

    expect(await screen.findByText(/max 2 decimal places/i)).toBeInTheDocument();
  });

  it('shows "Cannot transfer to your own wallet" when the resolved destination is the selected source wallet', async () => {
    // The destination account number resolves to the *same* wallet the user
    // picked as the source.
    vi.mocked(useResolveWallet).mockReturnValue({
      data: { walletId: SOURCE_WALLET.id, accountNumber: SOURCE_WALLET.accountNumber, currency: 'USD' },
      isFetching: false,
      isError: false,
    } as unknown as ReturnType<typeof useResolveWallet>);

    render(<InitiateTransferForm />);
    const user = await selectSourceWallet();
    await user.type(screen.getByLabelText(/destination account number/i), SOURCE_WALLET.accountNumber);

    expect(await screen.findByText(/cannot transfer to your own wallet/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send transfer/i })).toBeDisabled();
  });

  it('submits a valid transfer and navigates to the new transfer on success', async () => {
    // Destination resolves to a different wallet — a valid transfer.
    vi.mocked(useResolveWallet).mockReturnValue({
      data: { walletId: DEST_WALLET_ID, accountNumber: 'TN-bbbb-0000000002', currency: 'USD' },
      isFetching: false,
      isError: false,
    } as unknown as ReturnType<typeof useResolveWallet>);

    render(<InitiateTransferForm />);
    const user = await selectSourceWallet();
    await user.type(screen.getByLabelText(/destination account number/i), 'TN-bbbb-0000000002');
    await user.type(screen.getByLabelText(/^amount/i), '25.50');

    const submit = screen.getByRole('button', { name: /send transfer/i });
    await waitFor(() => expect(submit).toBeEnabled());
    await user.click(submit);

    expect(mutateMock).toHaveBeenCalledWith(
      {
        walletFromId: SOURCE_WALLET.id,
        walletToId: DEST_WALLET_ID,
        amount: 25.5,
        idempotencyKey: expect.any(String),
      },
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
    );

    // Simulate the mutation succeeding and assert the redirect.
    const { onSuccess } = mutateMock.mock.calls[0][1];
    onSuccess({ id: 'transfer-123' });
    expect(pushMock).toHaveBeenCalledWith('/transfer/transfer-123');
  });
});
