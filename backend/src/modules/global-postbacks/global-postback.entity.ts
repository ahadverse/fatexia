import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum PostbackDirectionKind {
  /** An advertiser posts conversions to us. */
  INBOUND = 'INBOUND',
  /** We post conversions out to somewhere else. */
  OUTBOUND = 'OUTBOUND',
}

/**
 * Network-level postbacks, configured once in Admin → Settings instead of per offer.
 *
 * Inbound: an offer already carries its own `postbackSecret` + `allowedPostbackIps`,
 * which means every new offer needs the advertiser to be handed fresh credentials. A
 * global inbound entry authorises conversions for *any* offer, so one integration
 * covers the whole catalogue. Several can exist at once — one per advertiser platform,
 * so revoking one does not break the others.
 *
 * Outbound: fired for every approved conversion, on top of the affiliate's own postback
 * URL. This is where a network's BI endpoint, data warehouse or agency tracker goes.
 *
 * One table for both because the admin surface is one list and the lifecycle is
 * identical (name it, enable it, delete it). The direction decides which columns carry
 * meaning, which is why they are nullable rather than split across two tables that
 * would need two of every route.
 */
@Entity('global_postbacks')
export class GlobalPostback {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Operator-facing label — "Voluum", "BI warehouse". Not used in any request. */
  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ type: 'varchar', length: 10 })
  direction!: PostbackDirectionKind;

  /** OUTBOUND: the URL to call, with `{macro}` placeholders. Null for inbound. */
  @Column({ type: 'varchar', length: 1000, nullable: true })
  url!: string | null;

  /** INBOUND: the shared secret the caller must present. Null for outbound. */
  @Column({ type: 'varchar', length: 255, nullable: true })
  secret!: string | null;

  /**
   * INBOUND: comma-separated allowlist of source IPs.
   *
   * Nullable, and null means "any IP" — unlike the per-offer field, which requires one.
   * A global entry often fronts a platform whose egress addresses the operator does not
   * control, and forcing a placeholder there would be a false sense of restriction.
   */
  @Column({ type: 'varchar', length: 500, nullable: true })
  allowedIps!: string | null;

  @Column({ type: 'boolean', default: true })
  enabled!: boolean;

  /** Set on the first request this entry successfully authorised or delivered. */
  @Column({ type: 'timestamptz', nullable: true })
  lastUsedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
