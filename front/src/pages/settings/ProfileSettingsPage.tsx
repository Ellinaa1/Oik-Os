import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMyPreferences, updateMyPreferences } from '@/api/preferences.api';
import type { MemberPreferences } from '@/types/preferences';
import './ProfileSettingsPage.css';

const DEFAULT_PREFERENCES: MemberPreferences = {
  notificationPreferences: {
    push: true,
    sms: false,
    morningBriefingTime: '08:00',
  },
  timezone: 'UTC',
};

const FALLBACK_TIMEZONES = [
  'UTC',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Yerevan',
  'Asia/Tokyo',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Australia/Sydney',
];

const getTimezoneOptions = (): string[] => {
  const intlWithSupport = Intl as unknown as {
    supportedValuesOf?: (type: string) => string[];
  };

  const values = intlWithSupport.supportedValuesOf?.('timeZone');
  if (Array.isArray(values) && values.length > 0) {
    return values;
  }

  return FALLBACK_TIMEZONES;
};

const ProfileSettingsPage = () => {
  const [preferences, setPreferences] = useState<MemberPreferences>(DEFAULT_PREFERENCES);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const timezoneOptions = useMemo(() => getTimezoneOptions(), []);

  useEffect(() => {
    let isActive = true;

    const load = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const result = await getMyPreferences();

        if (isActive) {
          setPreferences(result);
        }
      } catch (err) {
        if (isActive) {
          const message = err instanceof Error ? err.message : 'Failed to load preferences.';
          setError(message);
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!successToast) {
      return undefined;
    }

    const timer = window.setTimeout(() => setSuccessToast(null), 2500);
    return () => window.clearTimeout(timer);
  }, [successToast]);

  const savePreferences = async () => {
    try {
      setIsSaving(true);
      setError(null);
      const updated = await updateMyPreferences(preferences);
      setPreferences(updated);
      setSuccessToast('Preferences saved successfully.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save preferences.';
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="settings-screen">
      <section className="settings-header">
        <div>
          <p className="settings-eyebrow">Profile</p>
          <h1>Settings</h1>
          <p className="settings-subtitle">Manage notifications, morning briefing time, and timezone.</p>
        </div>

        <button
          type="button"
          className="settings-save-btn"
          onClick={() => void savePreferences()}
          disabled={isLoading || isSaving}
        >
          {isSaving ? 'Saving...' : 'Save'}
        </button>
      </section>

      <Link to="/calendar" className="settings-back-link">
        Back to Calendar
      </Link>

      {isLoading ? <div className="settings-state">Loading profile settings...</div> : null}
      {error ? <div className="settings-state settings-error">{error}</div> : null}

      {!isLoading ? (
        <section className="settings-panel">
          <div className="setting-row">
            <div>
              <h2>Push Notifications</h2>
              <p>Receive push notifications for important household updates.</p>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={preferences.notificationPreferences.push}
                onChange={(event) =>
                  setPreferences((prev) => ({
                    ...prev,
                    notificationPreferences: {
                      ...prev.notificationPreferences,
                      push: event.target.checked,
                    },
                  }))
                }
              />
              <span className="slider" />
            </label>
          </div>

          <div className="setting-row">
            <div>
              <h2>SMS Notifications</h2>
              <p>Send text message alerts for day-critical reminders.</p>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={preferences.notificationPreferences.sms}
                onChange={(event) =>
                  setPreferences((prev) => ({
                    ...prev,
                    notificationPreferences: {
                      ...prev.notificationPreferences,
                      sms: event.target.checked,
                    },
                  }))
                }
              />
              <span className="slider" />
            </label>
          </div>

          <div className="setting-row">
            <div>
              <h2>Morning Briefing</h2>
              <p>Choose what time you want to receive your daily overview.</p>
            </div>
            <input
              type="time"
              className="settings-input"
              value={preferences.notificationPreferences.morningBriefingTime}
              onChange={(event) =>
                setPreferences((prev) => ({
                  ...prev,
                  notificationPreferences: {
                    ...prev.notificationPreferences,
                    morningBriefingTime: event.target.value,
                  },
                }))
              }
            />
          </div>

          <div className="setting-row">
            <div>
              <h2>Timezone</h2>
              <p>Use your local timezone for scheduling and reminders.</p>
            </div>
            <select
              className="settings-input"
              value={preferences.timezone}
              onChange={(event) => setPreferences((prev) => ({ ...prev, timezone: event.target.value }))}
            >
              {timezoneOptions.map((timezone) => (
                <option key={timezone} value={timezone}>
                  {timezone}
                </option>
              ))}
            </select>
          </div>
        </section>
      ) : null}

      {successToast ? <div className="settings-toast">{successToast}</div> : null}
    </main>
  );
};

export default ProfileSettingsPage;
