export interface Equipment {
  id: number;
  name: string;
  category: string;
  description: string;
  priceExclVat: number;
  priceInclVat: number;
  image?: string;
  filmYear2?: boolean;
}

export interface CartItem {
  equipment: Equipment;
  days: number;
}

export interface CheckoutInfo {
  name: string;
  email: string;
  className: string;
  dateFrom: string;
  dateTo: string;
}

export type Category = 'ALL' | 'CAMERA' | 'GRIP' | 'LIGHTS' | 'SOUND' | 'LOCATION' | 'BOOKS';
