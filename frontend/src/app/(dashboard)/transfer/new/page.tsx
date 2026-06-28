import { PageHeader } from '@ledger/ui';
import { COPY } from '@/constants/copy';
import { InitiateTransferForm } from './_components/initiate-transfer-form';

export default function NewTransferPage() {
  return (
    <div className="mx-auto max-w-lg space-y-6">
      <PageHeader
        title={COPY.transfers.formTitle}
        description={COPY.transfers.transferFormDescription}
      />
      <InitiateTransferForm />
    </div>
  );
}
