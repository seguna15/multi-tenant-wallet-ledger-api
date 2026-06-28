import {
  TransferExportRow,
  TransferTenantExportRow,
} from '@modules/transfer/types';


export const EXPORT_PAGE_SIZE = 500;

export const EXPORT_COLUMNS: { key: keyof TransferExportRow; label: string }[] = [
   { key: 'date', label: 'Date' },
   { key: 'direction', label: 'Direction' },
   { key: 'counterpartyAccount', label: 'Counterparty Account' },
   { key: 'amount', label: 'Amount' },
   { key: 'currency', label: 'Currency' },
   { key: 'status', label: 'Status' },
 ];

export const TENANT_EXPORT_COLUMNS: {
   key: keyof TransferTenantExportRow;
   label: string;
 }[] = [
   { key: 'date', label: 'Date' },
   { key: 'fromAccount', label: 'From Account' },
   { key: 'toAccount', label: 'To Account' },
   { key: 'amount', label: 'Amount' },
   { key: 'currency', label: 'Currency' },
   { key: 'status', label: 'Status' },
   { key: 'reference', label: 'Reference' },
 ];