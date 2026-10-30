import apiClient, { retryRequest } from './apiClient';
import { handleError } from './errorHandler';
import { mapEmergencyContact, mapArray, mapId } from './responseMapper';

export interface EmergencyContact {
  id: string;
  userId: string;
  name: string;
  phone: string;
  relationship?: string;
  priority?: number;
}

export interface SOSAlert {
  id: string;
  userId: string;
  rideId?: string;
  location: {
    lat: number;
    lng: number;
  };
  status: 'ACTIVE' | 'RESOLVED' | 'CANCELLED';
  createdAt: string;
  resolvedAt?: string;
}

/**
 * Get emergency contacts
 */
export const getEmergencyContacts = async () => {
  try {
    const response = await retryRequest(() =>
      apiClient.get('/emergency/contacts')
    );

    const contacts = mapArray(
      response.data.data || response.data.contacts || [],
      mapEmergencyContact
    );
    return {
      success: true,
      data: contacts,
    };
  } catch (error) {
    handleError(error);
    throw error;
  }
};

/**
 * Add emergency contact
 */
export const addEmergencyContact = async (
  name: string,
  phone: string,
  relationship?: string
) => {
  try {
    const response = await retryRequest(() =>
      apiClient.post('/emergency/contacts', {
        name,
        phone,
        relationship,
      })
    );

    const contact = mapEmergencyContact(response.data.data || response.data);
    return {
      success: true,
      data: contact,
    };
  } catch (error) {
    handleError(error);
    throw error;
  }
};

/**
 * Update emergency contact
 */
export const updateEmergencyContact = async (
  contactId: string,
  updates: Partial<EmergencyContact>
) => {
  try {
    const response = await retryRequest(() =>
      apiClient.patch(`/emergency/contacts/${contactId}`, updates)
    );

    const contact = mapEmergencyContact(response.data.data || response.data);
    return {
      success: true,
      data: contact,
    };
  } catch (error) {
    handleError(error);
    throw error;
  }
};

/**
 * Delete emergency contact
 */
export const deleteEmergencyContact = async (contactId: string) => {
  try {
    const response = await retryRequest(() =>
      apiClient.delete(`/emergency/contacts/${contactId}`)
    );

    return {
      success: true,
      data: response.data.data || response.data,
    };
  } catch (error) {
    handleError(error);
    throw error;
  }
};

/**
 * Trigger SOS alert
 */
export const triggerSOS = async (
  location: { lat: number; lng: number },
  rideId?: string
) => {
  try {
    const response = await retryRequest(() =>
      apiClient.post('/safety/sos', {
        location,
        rideId,
      })
    );

    const sos = mapId(response.data.data || response.data);
    return {
      success: true,
      data: sos,
    };
  } catch (error) {
    handleError(error);
    throw error;
  }
};

/**
 * Cancel SOS alert
 */
export const cancelSOS = async (rideId: string) => {
  try {
    const response = await retryRequest(() =>
      apiClient.post('/safety/sos/cancel', { rideId })
    );

    return {
      success: true,
      data: response.data.data || response.data,
    };
  } catch (error) {
    handleError(error);
    throw error;
  }
};

/**
 * Update live location during SOS
 */
export const updateSOSLocation = async (
  rideId: string,
  location: { lat: number; lng: number; accuracy?: number }
) => {
  try {
    const response = await retryRequest(() =>
      apiClient.post('/safety/location', {
        rideId,
        location,
      })
    );

    return {
      success: true,
      data: response.data.data || response.data,
    };
  } catch (error) {
    handleError(error, undefined, true); // Don't show toast for location updates
    throw error;
  }
};

/**
 * Alert emergency services
 */
export const alertEmergencyServices = async (
  rideId: string,
  serviceType: 'police' | 'ambulance',
  location: { lat: number; lng: number }
) => {
  try {
    const response = await retryRequest(() =>
      apiClient.post('/safety/emergency-services', {
        rideId,
        serviceType,
        location,
      })
    );

    return {
      success: true,
      data: response.data.data || response.data,
    };
  } catch (error) {
    handleError(error);
    throw error;
  }
};

/**
 * Notify emergency contacts
 */
export const notifyEmergencyContacts = async (rideId: string) => {
  try {
    const response = await retryRequest(() =>
      apiClient.post('/safety/notify-contacts', { rideId })
    );

    return {
      success: true,
      data: response.data.data || response.data,
    };
  } catch (error) {
    handleError(error);
    throw error;
  }
};

/**
 * Get SOS record for a ride
 */
export const getSOSRecord = async (rideId: string) => {
  try {
    const response = await retryRequest(() =>
      apiClient.get(`/safety/record/${rideId}`)
    );

    const record = mapId(response.data.data || response.data);
    return {
      success: true,
      data: record,
    };
  } catch (error) {
    handleError(error);
    throw error;
  }
};

/**
 * Get SOS history
 */
export const getSOSHistory = async (limit = 10) => {
  try {
    const response = await retryRequest(() =>
      apiClient.get('/safety/history', { params: { limit } })
    );

    const history = mapArray(response.data.data || response.data.history || []);
    return {
      success: true,
      data: history,
    };
  } catch (error) {
    handleError(error);
    throw error;
  }
};

/**
 * Get active SOS alerts (admin)
 */
export const getActiveSOS = async () => {
  try {
    const response = await retryRequest(() =>
      apiClient.get('/safety/active-sos')
    );

    const alerts = mapArray(response.data.data || response.data.alerts || []);
    return {
      success: true,
      data: alerts,
    };
  } catch (error) {
    handleError(error);
    throw error;
  }
};

/**
 * Resolve SOS incident
 */
export const resolveSOSIncident = async (
  rideId: string,
  resolutionNotes?: string
) => {
  try {
    const response = await retryRequest(() =>
      apiClient.post('/safety/resolve', {
        rideId,
        resolutionNotes,
      })
    );

    return {
      success: true,
      data: response.data.data || response.data,
    };
  } catch (error) {
    handleError(error);
    throw error;
  }
};

export default {
  getEmergencyContacts,
  addEmergencyContact,
  updateEmergencyContact,
  deleteEmergencyContact,
  triggerSOS,
  cancelSOS,
  updateSOSLocation,
  alertEmergencyServices,
  notifyEmergencyContacts,
  getSOSRecord,
  getSOSHistory,
  getActiveSOS,
  resolveSOSIncident,
};
