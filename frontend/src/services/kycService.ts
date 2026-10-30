import apiClient, { retryRequest } from './apiClient';
import { handleError } from './errorHandler';
import { mapKYC, mapId } from './responseMapper';

export interface KYCDocuments {
  govtId?: File;
  govtIdType?: 'AADHAR' | 'DRIVING_LICENSE';
  rc?: File;
  insurance?: File;
  pollutionCert?: File;
  selfie?: File;
}

export interface KYCStatus {
  id: string;
  userId: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  documents: any;
  rejectionReason?: string;
  submittedAt?: string;
  approvedAt?: string;
}

/**
 * Get KYC status
 */
export const getKYCStatus = async () => {
  try {
    const response = await retryRequest(() =>
      apiClient.get('/kyc/status')
    );

    const kyc = mapKYC(response.data.data || response.data);
    return {
      success: true,
      data: kyc,
    };
  } catch (error) {
    handleError(error);
    throw error;
  }
};

/**
 * Upload KYC documents
 */
export const uploadKYCDocuments = async (documents: KYCDocuments) => {
  try {
    const formData = new FormData();

    if (documents.govtId) {
      formData.append('govtId', documents.govtId);
      formData.append('govtIdType', documents.govtIdType || 'AADHAR');
    }
    if (documents.rc) {
      formData.append('rc', documents.rc);
    }
    if (documents.insurance) {
      formData.append('insurance', documents.insurance);
    }
    if (documents.pollutionCert) {
      formData.append('pollutionCert', documents.pollutionCert);
    }
    if (documents.selfie) {
      formData.append('selfie', documents.selfie);
    }

    const response = await retryRequest(() =>
      apiClient.post('/kyc/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
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
 * Submit KYC for verification
 */
export const submitKYC = async () => {
  try {
    const response = await retryRequest(() =>
      apiClient.post('/kyc/submit')
    );

    const kyc = mapKYC(response.data.data || response.data);
    return {
      success: true,
      data: kyc,
    };
  } catch (error) {
    handleError(error);
    throw error;
  }
};

/**
 * Verify face with selfie
 */
export const verifyFace = async (selfieFile: File) => {
  try {
    const formData = new FormData();
    formData.append('selfie', selfieFile);

    const response = await retryRequest(() =>
      apiClient.post('/kyc/verify-face', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
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
 * Get KYC verification history
 */
export const getKYCHistory = async () => {
  try {
    const response = await retryRequest(() =>
      apiClient.get('/kyc/history')
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
 * Resubmit KYC after rejection
 */
export const resubmitKYC = async (documents: KYCDocuments) => {
  try {
    const formData = new FormData();

    if (documents.govtId) {
      formData.append('govtId', documents.govtId);
      formData.append('govtIdType', documents.govtIdType || 'AADHAR');
    }
    if (documents.rc) {
      formData.append('rc', documents.rc);
    }
    if (documents.insurance) {
      formData.append('insurance', documents.insurance);
    }
    if (documents.pollutionCert) {
      formData.append('pollutionCert', documents.pollutionCert);
    }
    if (documents.selfie) {
      formData.append('selfie', documents.selfie);
    }

    const response = await retryRequest(() =>
      apiClient.post('/kyc/resubmit', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })
    );

    const kyc = mapKYC(response.data.data || response.data);
    return {
      success: true,
      data: kyc,
    };
  } catch (error) {
    handleError(error);
    throw error;
  }
};

/**
 * Get document upload URL (for direct upload)
 */
export const getUploadUrl = async (documentType: string) => {
  try {
    const response = await retryRequest(() =>
      apiClient.get('/kyc/upload-url', {
        params: { documentType },
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
  getKYCStatus,
  uploadKYCDocuments,
  submitKYC,
  verifyFace,
  getKYCHistory,
  resubmitKYC,
  getUploadUrl,
};
