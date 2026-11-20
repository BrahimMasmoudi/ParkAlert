export type UserRole = 'agent' | 'police' | 'owner';

export interface User {
  uid: string;
  email: string;
  name: string;
  phone?: string;
  photoURL?: string;
  roles: UserRole[];
  fullName?: string;
  identityNumber?: string;
  birthDate?: string;
  createdAt?: Date | any; // Using any to accommodate Firestore Timestamp or Date
  updatedAt?: Date | any;
}
