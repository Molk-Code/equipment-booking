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
  included?: string[];
  notes?: string;
}

export interface CartItem {
  equipment: Equipment;
  quantity?: number;
}

export interface CheckoutInfo {
  name: string;
  email: string;
  className: string;
  project: string;
}

export type Category = 'ALL' | 'CAMERA' | 'GRIP' | 'LIGHTS' | 'SOUND' | 'LOCATION' | 'BOOKS';

// ---- Inventory System Types ----

export type ProjectStatus = 'active' | 'checked-out' | 'returned' | 'archived';
export type ItemStatus = 'checked-out' | 'returned' | 'damaged' | 'missing';

export interface InventoryProject {
  id: string;
  name: string;
  borrowers: string[];
  checkoutDate: string;
  returnDate: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectItem {
  projectId: string;
  equipmentName: string;
  checkoutTimestamp: string;
  checkinTimestamp: string;
  status: ItemStatus;
  damageNotes: string;
}

export interface QRScanEntry {
  timestamp: string;
  equipmentName: string;
}
