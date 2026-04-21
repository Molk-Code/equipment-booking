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
  location?: string;
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
  equipmentManager: string;
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
  // Feature 1: Task assignment for missing items
  assignedTo?: string;
  // Feature 2: Add-on checkout session metadata
  addonSessionId?: string;
  addonDate?: string;
  addonCollectedBy?: string;
  addonManager?: string;
}

export interface AddonSession {
  sessionId: string;
  date: string;
  collectedBy: string;
  manager: string;
}

export interface QRScanEntry {
  timestamp: string;
  equipmentName: string;
}

export interface Klasslista {
  film1: string[];
  film2: string[];
}
