import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * An advertiser tracking platform (Affmine, Affcity, MyLead, ...) and how *its* postback
 * writes our click id back. The tokens are stored verbatim — `#s1#`, `{aff_click_id}`,
 * `[ml_sub1]` — because the delimiter style belongs to the platform, not to us.
 */
@Entity('advertiser_networks')
export class AdvertiserNetwork {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', unique: true })
  name!: string;

  /** What the platform's postback substitutes with our click id, brackets included. */
  @Column({ type: 'varchar' })
  clickIdToken!: string;

  /** What it substitutes with the conversion's payout. Null = the generic `{sum}`. */
  @Column({ type: 'varchar', nullable: true })
  payoutToken!: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;
}
