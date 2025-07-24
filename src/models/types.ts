/**
 * Core application models and types
 */

export interface User {
  id: string;
  username: string;
  email: string;
  avatarUrl?: string;
  type: UserType;
  bio?: string;
  socialLinks?: SocialLinks;
  musicStyle?: string;
  walletAddress: string;
  notificationPreferences?: NotificationPreferences;
  certification?: CertificationStatus;
}

export type UserType = 'user';

export interface CertificationStatus {
  status: 'pending' | 'approved' | 'rejected' | 'none';
  lastRequestDate?: string;
  rejectionDate?: string;
}

export interface SocialLinks {
  twitter?: string;
  instagram?: string;
  website?: string;
}

export interface NotificationPreferences {
  newFollowers: boolean;
  nftSales: boolean;
  comments: boolean;
  mentions: boolean;
  likes: boolean;
}

export interface NFT {
  id: string;
  title: string;
  description: string;
  artist: User;
  imageUrl: string;
  audioUrl: string;
  price: number;
  metadata: NFTMetadata;
  status: NFTStatus;
  createdAt: string;
  hasPool?: boolean;
  tokenType?: 'woodeng' | 'sol';
  isListed?: boolean;
  listingPrice?: number;
}

export interface NFTMetadata {
  style: string;
  year: number;
  trackNumber?: number;
  albumName?: string;
  collection?: string;
  attributes: NFTAttribute[];
}

export interface NFTAttribute {
  trait_type: string;
  value: string;
}

export type NFTStatus = 'available' | 'sold' | 'auction' | 'listed';
