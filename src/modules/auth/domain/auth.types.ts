export type StaffRole = 'PICKUP' | 'WASH' | 'DELIVERY' | 'ADMIN';

export type Customer = {
  id: string;
  customerId: string;
  phoneNumber: string | null;
  address: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type Staff = {
  id: string;
  staffId: string;
  role: StaffRole;
  displayName: string | null;
  phoneNumber: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CustomerMissingProfileField = 'phoneNumber' | 'address';
