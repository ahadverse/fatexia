import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export enum NotificationLevel {
  INFO = 'INFO',
  SUCCESS = 'SUCCESS',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
}

export enum NotificationCategory {
  OFFER = 'OFFER',
  AFFILIATE = 'AFFILIATE',
  CONVERSION = 'CONVERSION',
  FRAUD = 'FRAUD',
  BILLING = 'BILLING',
  SYSTEM = 'SYSTEM',
}

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Null = broadcast to every admin, rather than one recipient's inbox.
  // Always set. A null userId used to mean "broadcast", which made audience a property
  // of the query rather than the row — affiliates saw the network's internal notices,
  // and one reader's acknowledgement cleared a broadcast for everyone. Notifications
  // are fanned out at write time instead (see notification.service's notifyNetwork).
  @Index()
  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'enum', enum: NotificationLevel, default: NotificationLevel.INFO })
  level!: NotificationLevel;

  @Column({ type: 'enum', enum: NotificationCategory, default: NotificationCategory.SYSTEM })
  category!: NotificationCategory;

  @Column({ type: 'varchar' })
  title!: string;

  @Column({ type: 'text' })
  body!: string;

  // In-app route the notification points at, e.g. /offers/access-requests.
  @Column({ type: 'varchar', nullable: true })
  link!: string | null;

  @Column({ type: 'timestamp', nullable: true })
  readAt!: Date | null;

  @Index()
  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;
}
