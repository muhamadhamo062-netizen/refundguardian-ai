export type PlatformKey = 'amazon' | 'uber_eats' | 'uber_rides' | 'doordash';

export type IssueKey =
  | 'late_delivery_auto'
  | 'trip_delay_auto'
  | 'missing_item'
  | 'cold_food'
  | 'charged_incorrectly'
  | 'damaged_item'
  | 'trip_issue'
  | 'driver_route_issue';

export type RowSpec = {
  key: PlatformKey;
  label: string;
  auto: { title: string; badge: string; issueKey: IssueKey };
  manual: Array<{ title: string; issueKey: IssueKey }>;
};

/** Suggested merchant inboxes (Uber/DoorDash). Amazon varies — user should enter a valid address. */
export const DEFAULT_SUPPORT_TO: Record<PlatformKey, string> = {
  amazon: '',
  uber_eats: 'support@uber.com',
  uber_rides: 'support@uber.com',
  doordash: 'help@doordash.com',
};

export const AI_PRIORITY_ROWS: RowSpec[] = [
  {
    key: 'amazon',
    label: 'Amazon',
    auto: { title: 'Late delivery', badge: '', issueKey: 'late_delivery_auto' },
    manual: [
      { title: 'Missing item', issueKey: 'missing_item' },
      { title: 'Charged incorrectly', issueKey: 'charged_incorrectly' },
      { title: 'Damaged item', issueKey: 'damaged_item' },
    ],
  },
  {
    key: 'uber_eats',
    label: 'Uber Eats',
    auto: { title: 'Late delivery', badge: '', issueKey: 'late_delivery_auto' },
    manual: [
      { title: 'Missing item', issueKey: 'missing_item' },
      { title: 'Cold food', issueKey: 'cold_food' },
      { title: 'Charged incorrectly', issueKey: 'charged_incorrectly' },
    ],
  },
  {
    key: 'uber_rides',
    label: 'Uber Rides',
    auto: { title: 'Trip delay', badge: '', issueKey: 'trip_delay_auto' },
    manual: [
      { title: 'Charged incorrectly', issueKey: 'charged_incorrectly' },
      { title: 'Trip issue', issueKey: 'trip_issue' },
      { title: 'Driver route issue', issueKey: 'driver_route_issue' },
    ],
  },
  {
    key: 'doordash',
    label: 'DoorDash',
    auto: { title: 'Late delivery', badge: '', issueKey: 'late_delivery_auto' },
    manual: [
      { title: 'Missing item', issueKey: 'missing_item' },
      { title: 'Cold food', issueKey: 'cold_food' },
      { title: 'Charged incorrectly', issueKey: 'charged_incorrectly' },
    ],
  },
];

export type SelectionState = Record<PlatformKey, Partial<Record<IssueKey, boolean>>>;

export function emptyAiPrioritySelection(): SelectionState {
  return {
    amazon: {},
    uber_eats: {},
    uber_rides: {},
    doordash: {},
  };
}

export function aiPriorityStorageKey(userId: string | null): string {
  return userId ? `rgAiPriority_v1_${userId}` : `rgAiPriority_v1_anon`;
}
