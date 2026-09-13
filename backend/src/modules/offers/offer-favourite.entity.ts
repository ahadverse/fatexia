import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

/**
 * An affiliate's bookmark on an offer.
 *
 * Purely the affiliate's own shortlist — it grants nothing and the admin side never
 * reads it. A row exists or it does not, so there is no `active` flag to go stale;
 * un-bookmarking deletes. The unique pair is what makes the toggle idempotent.
 *
 * It lives in the offers module rather than its own, because the only thing that ever
 * reads it is the affiliate offer list, and a separate module would have to be imported
 * by offers anyway.
 */
@Entity('offer_favourites')
@Unique(['offerId', 'affiliateId'])
export class OfferFavourite {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  offerId!: string;

  // Every read is "this affiliate's bookmarks", so the index that matters is on the
  // affiliate, not the offer.
  @Index()
  @Column({ type: 'uuid' })
  affiliateId!: string;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;
}
