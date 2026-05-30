export interface NotificationPreferences {
  push: boolean;
  sms: boolean;
  morningBriefingTime: string;
}

export interface MemberPreferences {
  notificationPreferences: NotificationPreferences;
  timezone: string;
}
