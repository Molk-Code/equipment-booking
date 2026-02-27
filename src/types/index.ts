export interface Equipment {
  id: number;
  name: string;
  category: string;
  description: string;
  priceExclVat: number;
  priceInclVat: number;
  image?: string;
  filmYear2?: boolean;
  available?: number;
}

export interface CartItem {
  equipment: Equipment;
  days: number;
  quantity?: number;
}

export interface CheckoutInfo {
  name: string;
  email: string;
  className: string;
  project: string;
  dateFrom: string;
  dateTo: string;
}

export type Category = 'ALL' | 'CAMERA' | 'GRIP' | 'LIGHTS' | 'SOUND' | 'LOCATION' | 'BOOKS';
