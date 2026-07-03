import * as DocumentPicker from 'expo-document-picker';
import { supabase } from './supabase';

export type CertificateType = 'pi' | 'pl' | 'dbs';

export interface PickedCertificate {
  uri: string;
  name: string;
  mimeType: string | null;
}

const LABELS: Record<CertificateType, string> = {
  pi: 'PI Insurance Certificate',
  pl: 'PL Insurance Certificate',
  dbs: 'DBS Check Certificate',
};

export function certificateLabel(type: CertificateType) {
  return LABELS[type];
}

// Opens the OS document/photo picker restricted to PDF + images. Returns null if cancelled.
export async function pickCertificate(): Promise<PickedCertificate | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/pdf', 'image/*'],
    copyToCacheDirectory: true,
  });
  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];
  return { uri: asset.uri, name: asset.name, mimeType: asset.mimeType ?? null };
}

// Uploads a previously-picked file to the surveyor-documents bucket under the given
// surveyor's folder, and returns the storage path to persist on the surveyors row.
export async function uploadCertificate(
  surveyorId: string,
  type: CertificateType,
  file: PickedCertificate
): Promise<string> {
  const ext = (file.name.split('.').pop() || 'pdf').toLowerCase();
  const path = `${surveyorId}/${type}_certificate_${Date.now()}.${ext}`;

  try {
    console.log('Starting upload - File URI:', file.uri);
    console.log('File name:', file.name);
    console.log('File mimeType:', file.mimeType);

    // Fetch the file and convert to blob
    const response = await fetch(file.uri);
    console.log('Fetch response status:', response.status);

    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.statusText}`);
    }

    const blob = await response.blob();
    console.log('Blob created, size:', blob.size);

    if (blob.size === 0) {
      throw new Error('File is empty');
    }

    // Upload to Supabase
    const { data, error } = await supabase.storage
      .from('surveyor-documents')
      .upload(path, blob, {
        contentType: file.mimeType || 'application/octet-stream',
      });

    if (error) {
      console.error('Supabase upload error:', error);
      throw new Error(`Upload failed: ${error.message}`);
    }

    console.log('Upload successful, returned data:', data);
    return path;
  } catch (e: any) {
    console.error('Certificate upload failed:', e.message || String(e));
    throw e;
  }
}

// Opens a 1hr signed URL for viewing/downloading an existing certificate.
export async function openCertificate(path: string) {
  const { data, error } = await supabase.storage
    .from('surveyor-documents')
    .createSignedUrl(path, 3600);
  if (error) throw error;
  if (data?.signedUrl) {
    const { Linking } = await import('react-native');
    await Linking.openURL(data.signedUrl);
  }
}
