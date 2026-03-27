// Linq Blue V3 Webhook Types
// Copied from: https://github.com/linq-team/ai-agent-example

export interface WebhookEvent {
  api_version: 'v3';
  event_id: string;
  created_at: string;
  trace_id: string;
  partner_id: string;
  event_type: string;
  data: unknown;
}

export interface MessageReceivedEvent extends WebhookEvent {
  event_type: 'message.received';
  data: MessageReceivedData;
}

export interface MessageReceivedData {
  chat_id: string;
  from: string;
  recipient_phone: string;
  received_at: string;
  is_from_me: boolean;
  service: 'iMessage' | 'SMS' | 'RCS';
  message: IncomingMessage;
}

export interface IncomingMessage {
  id: string;
  parts: MessagePart[];
  effect?: MessageEffect;
  reply_to?: ReplyTo;
}

export interface TextPart {
  type: 'text';
  value: string;
}

export interface MediaPart {
  type: 'media';
  url?: string;
  attachment_id?: string;
  filename?: string;
  mime_type?: string;
  size?: number;
}

export type MessagePart = TextPart | MediaPart;

export interface MessageEffect {
  type: 'screen' | 'bubble';
  name: string;
}

export interface ReplyTo {
  message_id: string;
  part_index?: number;
}

export function isMessageReceivedEvent(event: WebhookEvent): event is MessageReceivedEvent {
  return event.event_type === 'message.received';
}

export function extractTextContent(parts: MessagePart[]): string {
  return parts
    .filter((part): part is TextPart => part.type === 'text')
    .map(part => part.value)
    .join('\n');
}
