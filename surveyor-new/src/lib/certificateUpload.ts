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

// Uploads a file to Supabase storage using REST API with explicit auth
export async function uploadCertificate(
  surveyorId: string,
  type: CertificateType,
  file: PickedCertificate
): Promise<string> {
  const path = `${surveyorId}/${type}_certificate_${Date.now()}_${file.name}`;

  const response = await fetch(file.uri);
  const blob = await response.blob();

  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  if (!token) throw new Error('Not authenticated');

  const uploadResponse = await fetch(
    `http://192.168.1.91:8084/storage/v1/object/surveyor-documents/${path}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': file.mimeType || 'application/octet-stream',
      },
      body: blob,
    }
  );

  if (!uploadResponse.ok) {
    const error = await uploadResponse.text();
    throw new Error(`Upload failed: ${uploadResponse.status} - ${error}`);
  }

  return path;
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
