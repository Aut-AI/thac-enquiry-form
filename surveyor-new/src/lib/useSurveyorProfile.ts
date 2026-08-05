import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from './supabase';
import { Surveyor } from '../types';

// Shared by ProfileScreen and its sub-pages (CoverageArea, Insurance,
// Availability) so each one loads and refreshes the same surveyor row
// independently, without threading it through navigation params (which
// would go stale as soon as one screen saves a change).
export function useSurveyorProfile() {
  const [surveyor, setSurveyor] = useState<Surveyor | null>(null);
  const [loading, setLoading] = useState(true);
  const loadRequestId = useRef(0);

  const reload = useCallback(async () => {
    const requestId = ++loadRequestId.current;
    setLoading(true);

    // getSession() reads the already-established local session instead of
    // making a fresh network round-trip to the auth server -- reload() can
    // fire again (useFocusEffect re-runs on every focus) before an
    // in-flight call has resolved, and a stale response landing after a
    // newer one would otherwise clobber the profile back to empty.
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) {
      if (requestId === loadRequestId.current) setLoading(false);
      return null;
    }

    const { data, error } = await supabase
      .from('surveyors')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (requestId !== loadRequestId.current) return null; // a newer reload() call has since started

    if (error) console.error('Failed to load surveyor profile:', error.message);
    setSurveyor(data);
    setLoading(false);
    return data;
  }, []);

  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  return { surveyor, loading, reload };
}
