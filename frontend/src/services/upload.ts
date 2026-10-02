import { platformAPI } from './api';

export type UploadPurpose = 'profile' | 'pan' | 'face_front' | 'face_left' | 'face_right';
const TYPES = { profile: ['image/jpeg', 'image/png'], pan: ['image/jpeg', 'image/png', 'application/pdf'], face_front: ['image/jpeg'], face_left: ['image/jpeg'], face_right: ['image/jpeg'] };
export async function uploadToS3(file: Blob, purpose: UploadPurpose): Promise<string> {
  if (!Object.prototype.hasOwnProperty.call(TYPES, purpose) || !TYPES[purpose].includes(file.type)) throw new Error('Choose an allowed JPG, PNG, or PDF file for this field.');
  if (file.size < 1024 || file.size > 5 * 1024 * 1024) throw new Error('Files must be between 1 KB and 5 MB.');
  try {
    const response = await platformAPI.presignUpload({ purpose, contentType: file.type });
    const { url, fields, key } = response.data.data;
    const form = new FormData();
    Object.entries(fields).forEach(([name, value]) => form.append(name, String(value)));
    // S3 POST policy requires the file part to be LAST. Do not set Content-Type;
    // the browser sets multipart/form-data with its generated boundary.
    form.append('file', file, file instanceof File ? file.name : `${purpose}.jpg`);
    let result: Response;
    try {
      result = await fetch(url, { method: 'POST', body: form, credentials: 'omit', signal: AbortSignal.timeout(120000) });
    } catch (error: any) {
      if (error.name === 'TimeoutError') throw error;
      throw new Error('We could not upload your file. Check your connection and try again shortly.');
    }
    if (!result.ok) throw new Error('Upload failed or the upload ticket expired. Select the file again to retry.');
    return key;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || (error.name === 'TimeoutError' ? 'Upload timed out. Please try again.' : error.message) || 'Could not upload the file. Check your connection.');
  }
}
