import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
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
    console.log('Reading file from:', file.uri);
    const base64 = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.Base64 });
    console.log('File read successfully, size:', base64.length);

    const { error } = await supabase.storage
      .from('surveyor-documents')
      .upload(path, decode(base64), {
        contentType: file.mimeType || 'application/octet-stream',
        upsert: false,
      });

    if (error) {
      console.error('Upload error:', error);
      throw new Error(`Upload failed: ${error.message}`);
    }
    console.log('Upload successful to path:', path);
    return path;
  } catch (e: any) {
    console.error('Certificate upload error:', e);
    throw e;
  }
}

function decode(base64: string): Uint8Array {
  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return bytes;
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
