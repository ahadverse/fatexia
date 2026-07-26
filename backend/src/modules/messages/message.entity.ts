import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export enum MessageDirection {
  // Admin/manager → affiliate.
  OUTBOUND = 'OUTBOUND',
  // Affiliate → admin/manager.
  INBOUND = 'INBOUND',
}

// Support/messaging between the network and an affiliate. A thread is every row
// sharing an `affiliateId`, ordered by createdAt — no separate thread entity, since
// conversations here are always network↔one affiliate.
@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  affiliateId!: string;

  @Column({ type: 'enum', enum: MessageDirection })
  direction!: MessageDirection;

  // No subject line: this is a chat between the network and one affiliate, not
  // email. There is one conversation per affiliate, so a per-message subject was
  // never doing any routing or grouping work.
  @Column({ type: 'text' })
  body!: string;

  // Who wrote it — null for system-generated messages.
  @Column({ type: 'uuid', nullable: true })
  senderUserId!: string | null;

  @Column({ type: 'timestamp', nullable: true })
  readAt!: Date | null;

  @Index()
  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;
}
