import type { Currency, LineInput } from './validation.js';
export interface User {
  id: string;
  name: string;
  email: string;
}
export interface Party {
  name: string;
  address: string;
  country: string;
  email: string;
  phone: string;
  taxId: string;
}
export interface Profile extends Party {
  paymentDetails: string;
}
export interface Client extends Party {
  id: string;
  kind: 'COMPANY' | 'PERSON';
  notes: string;
  createdAt: string;
  updatedAt: string;
}
export interface Service {
  id: string;
  description: string;
  unit: string;
  unitPrice: string;
  taxRate: string;
  currency: Currency;
}
export interface Item extends LineInput {
  id: string;
  position: number;
  base: string;
  discount: string;
  net: string;
  tax: string;
  total: string;
}
export interface Invoice {
  id: string;
  number: string;
  clientId: string | null;
  issueDate: string;
  dueDate: string;
  currency: Currency;
  status: 'DRAFT' | 'SENT' | 'PAID' | 'CANCELLED';
  effectiveStatus: string;
  sellerSnapshot: Profile;
  clientSnapshot: Party;
  items: Item[];
  subtotal: string;
  discountTotal: string;
  taxTotal: string;
  total: string;
  notes: string;
  revision: number;
  paidAt: string | null;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
  events: { id: string; action: string; createdAt: string }[];
}
