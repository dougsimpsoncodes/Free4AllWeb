// Shared API response types for the client

export interface Team {
  id: number;
  name: string;
  abbreviation: string;
  city: string;
  leagueId: number;
  externalId: string;
  logoUrl: string;
  primaryColor: string;
  sport: string;
  conference: string;
  division: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Restaurant {
  id: number;
  name: string;
  logoUrl: string;
  website: string;
  appStoreUrl: string;
  playStoreUrl: string;
  primaryColor: string;
  isActive: boolean;
}

export interface AlertPreference {
  id: number;
  userId: string;
  teamId: number;
  restaurantId: number;
  emailAlerts: boolean;
  smsAlerts: boolean;
  alertTiming: string;
  isActive: boolean;
}

export interface AlertHistory {
  id: number;
  userId: string;
  triggeredDealId: number;
  alertType: 'email' | 'sms';
  sentAt: Date;
  status: 'sent' | 'failed' | 'pending';
}

export interface Promotion {
  id: number;
  teamId: number;
  restaurantId: number;
  title: string;
  description: string;
  offerValue: string;
  triggerCondition: string;
  redemptionInstructions: string;
  promoCode: string;
  validUntil: Date;
  isActive: boolean;
  isSeasonal: boolean;
  source: string;
  discoveryData: any;
  approvalStatus: string;
  approvedBy: string;
  approvedAt: Date;
  createdAt: Date;
}

export interface Game {
  id: number;
  teamId: number;
  opponent: string;
  gameDate: Date;
  isHome: boolean;
  teamScore: number;
  opponentScore: number;
  isComplete: boolean;
  gameStats: any;
  externalId: string;
}

export interface TriggeredDeal {
  id: number;
  promotionId: number;
  dealPageId: number;
  gameId: number;
  triggeredAt: Date;
  expiresAt: Date;
  isActive: boolean;
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  profileImageUrl: string;
  city: string;
  zipCode: string;
  phoneNumber: string;
  role: 'user' | 'admin';
  createdAt: Date;
  updatedAt: Date;
}

export interface DealPage {
  id: number;
  slug: string;
  title: string;
  restaurant: string;
  offerDescription: string;
  triggerCondition: string;
  dealValue: string;
  promoCode: string;
  instructions: string;
  terms: string;
  validFrom: Date;
  validUntil: Date;
  isActive: boolean;
  sourceUrl: string;
  imageUrl: string;
  discoveredSiteId: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface MLBStatus {
  isRunning: boolean;
  isProcessing: boolean;
  lastRunTime?: Date;
  nextRunTime?: Date;
  stats?: any;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> {
  deals: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}