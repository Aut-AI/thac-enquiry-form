export type DispatchState =
  | 'pending_approval' | 'waiting_for_plans'
  | 'red' | 'orange' | 'yellow' | 'green' | 'archived';

export type UrgencyState = 'red' | 'orange' | 'yellow' | 'grey' | 'green';

export interface Surveyor {
  id: string;
  user_id: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  home_postcode: string | null;
  home_lat: number | null;
  home_lng: number | null;
  radius_miles: number;
  hourly_rate: number | null;
  is_active: boolean;
  pi_expiry: string | null;
  pl_expiry: string | null;
  dbs_expiry: string | null;
}

export interface Job {
  id: string;
  reference: string | null;
  survey_type: string;
  site_postcode: string | null;
  site_lat: number | null;
  site_lng: number | null;
  parking_lat: number | null;
  parking_lng: number | null;
  urgency_state: UrgencyState;
  dispatch_state: DispatchState;
  sla_deadline: string | null;
  surveyor_id: string | null;
  surveyor_pay_amount: number | null;
  tree_count_band: string | null;
  survey_date: string | null;
  survey_date_confirmed: boolean;
  site_access_notes: string | null;
  site_location_tag: string | null;
  doc_block_plan_url: string | null;
  doc_topo_survey_url: string | null;
  doc_other_urls: string | null;
  field_data_uploaded: boolean;
  surveyor_notes: string | null;
  claimed_at: string | null;
  internal_notes: string | null;
}

export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
  JobDetail: { jobId: string };
};

export type BottomTabParamList = {
  Map: undefined;
  Jobs: undefined;
  Profile: undefined;
};
