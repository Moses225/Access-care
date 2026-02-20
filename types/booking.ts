export interface TimeSlot {
  time: string;
  available: boolean;
  providerId: string;
}

export interface BookingData {
  id: string;
  userId: string;
  providerId: string;
  providerName: string;
  date: string;
  time: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  notes?: string;
  createdAt: string;
  patientName: string;
  patientPhone: string;
}

export interface AvailabilitySlot {
  date: string;
  slots: TimeSlot[];
}