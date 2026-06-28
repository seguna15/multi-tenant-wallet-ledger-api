export const RABBITMQ_CHANNEL = 'RABBITMQ_CHANNEL';
export const TRANSFER_EXCHANGE = 'transfer.events'; // topic exchange
export const TRANSFER_QUEUE = 'transfer.initiated'; // durable queue
export const TRANSFER_COMPLETED_QUEUE = 'transfer.completed'; // durable queue  ← ADD
export const NOTIFICATION_QUEUE = 'notification.transfer'; // durable queue
export const TRANSFER_COMPLETED_DLQ_QUEUE = 'transfer.completed.dlq'; // ← add this


export const PG_NOTIFY_CLIENT = 'PG_NOTIFY_CLIENT';
export const OUTBOX_CHANNEL = 'outbox_channel';
