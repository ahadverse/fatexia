export type AdvertiserStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED';

export interface Advertiser {
  id: string;
  name: string;
  status: AdvertiserStatus;
  contactName: string | null;
  contactEmail: string | null;
  phone: string | null;
  country: string | null;
  websiteUrl: string | null;
  accountManagerId: string | null;
  notes: string | null;
  offerCount: number;
  createdAt: string;
}

export interface CreateAdvertiserInput {
  name: string;
  status?: AdvertiserStatus;
  contactName?: string;
  contactEmail?: string;
  phone?: string;
  country?: string;
  websiteUrl?: string;
  accountManagerId?: string | null;
  notes?: string;
}
