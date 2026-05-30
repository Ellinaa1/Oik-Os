import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  createManualEvent,
  deleteScheduleEvent,
  listScheduleEvents,
  updateScheduleEvent,
} from '@/api/schedule.api';
import type { CalendarMember, EventUpsertPayload, ScheduleEvent } from '@/types/schedule';
import './CalendarPage.css';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type ModalMode = 'create' | 'edit';

interface ModalState {
  mode: ModalMode;
  eventId?: string;
}

interface EventFormState {
  title: string;
  memberId: string;
  isAllDay: boolean;
  startInput: string;
  endInput: string;
  location: string;
  description: string;
}

const toDayKey = (timestamp: number): string => {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toDateInputValue = (timestamp: number): string => {
  return toDayKey(timestamp);
};

const toDateTimeInputValue = (timestamp: number): string => {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const formatVisibleDate = (timestamp: number): string => {
  return new Date(timestamp).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatMonthLabel = (date: Date): string => {
  return date.toLocaleString(undefined, {
    month: 'long',
    year: 'numeric',
  });
};

const sortEvents = (events: ScheduleEvent[]): ScheduleEvent[] => {
  return [...events].sort((a, b) => {
    if (a.startAt !== b.startAt) {
      return a.startAt - b.startAt;
    }

    return a.id.localeCompare(b.id);
  });
};

const buildCalendarDays = (monthCursor: Date): Date[] => {
  const year = monthCursor.getFullYear();
  const month = monthCursor.getMonth();
  const firstDayOfMonth = new Date(year, month, 1);
  const startOffset = firstDayOfMonth.getDay();
  const gridStart = new Date(year, month, 1 - startOffset);
  const days: Date[] = [];

  for (let index = 0; index < 42; index += 1) {
    days.push(new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + index));
  }

  return days;
};

const buildCreateFormFromDay = (day: Date, memberId = ''): EventFormState => {
  const startAt = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 9, 0, 0, 0).getTime();
  const endAt = startAt + 60 * 60 * 1000;

  return {
    title: '',
    memberId,
    isAllDay: false,
    startInput: toDateTimeInputValue(startAt),
    endInput: toDateTimeInputValue(endAt),
    location: '',
    description: '',
  };
};

const buildFormFromEvent = (event: ScheduleEvent): EventFormState => {
  if (event.isAllDay) {
    const endInclusive = Math.max(event.startAt, event.endAt - 1);

    return {
      title: event.title,
      memberId: event.memberId,
      isAllDay: true,
      startInput: toDateInputValue(event.startAt),
      endInput: toDateInputValue(endInclusive),
      location: event.location || '',
      description: event.description || '',
    };
  }

  return {
    title: event.title,
    memberId: event.memberId,
    isAllDay: false,
    startInput: toDateTimeInputValue(event.startAt),
    endInput: toDateTimeInputValue(event.endAt),
    location: event.location || '',
    description: event.description || '',
  };
};

const normalizeFormIntoPayload = (form: EventFormState): EventUpsertPayload => {
  const title = form.title.trim();
  if (!title) {
    throw new Error('Title is required.');
  }

  let startAt: number;
  let endAt: number;

  if (form.isAllDay) {
    const startDay = Date.parse(`${form.startInput}T00:00`);
    const endDay = Date.parse(`${form.endInput}T00:00`);

    if (!Number.isFinite(startDay) || !Number.isFinite(endDay)) {
      throw new Error('Please choose valid dates.');
    }

    startAt = startDay;
    endAt = endDay + DAY_MS;
  } else {
    startAt = Date.parse(form.startInput);
    endAt = Date.parse(form.endInput);

    if (!Number.isFinite(startAt) || !Number.isFinite(endAt)) {
      throw new Error('Please choose valid start/end date and time.');
    }
  }

  if (endAt <= startAt) {
    throw new Error('End time must be after start time.');
  }

  return {
    title,
    startAt,
    endAt,
    memberId: form.memberId || undefined,
    isAllDay: form.isAllDay,
    location: form.location.trim() || undefined,
    description: form.description.trim() || undefined,
  };
};

const CalendarPage = () => {
  const [householdId, setHouseholdId] = useState('');
  const [members, setMembers] = useState<CalendarMember[]>([]);
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalState, setModalState] = useState<ModalState | null>(null);
  const [formState, setFormState] = useState<EventFormState | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const defaultMemberId = members[0]?.id || '';
  const calendarDays = useMemo(() => buildCalendarDays(monthCursor), [monthCursor]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, ScheduleEvent[]>();

    for (const day of calendarDays) {
      const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
      const dayEnd = dayStart + DAY_MS;
      const key = toDayKey(dayStart);
      const dayEvents = sortEvents(events.filter((event) => event.startAt < dayEnd && event.endAt > dayStart));
      map.set(key, dayEvents);
    }

    return map;
  }, [calendarDays, events]);

  const activeEvent = useMemo(() => {
    if (!modalState || modalState.mode !== 'edit' || !modalState.eventId) {
      return null;
    }

    return events.find((event) => event.id === modalState.eventId) || null;
  }, [modalState, events]);

  const loadSchedule = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const snapshot = await listScheduleEvents();
      setHouseholdId(snapshot.householdId);
      setMembers(snapshot.members);
      setEvents(sortEvents(snapshot.events.filter((event) => !event.deletedAt)));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load schedule.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadSchedule();
  }, []);

  const closeModal = () => {
    if (isSubmitting || isDeleting) {
      return;
    }

    setModalState(null);
    setFormState(null);
    setFormError(null);
  };

  const openCreateModalForDay = (day: Date) => {
    setModalState({ mode: 'create' });
    setFormState(buildCreateFormFromDay(day, defaultMemberId));
    setFormError(null);
  };

  const openCreateModalNow = () => {
    setModalState({ mode: 'create' });
    setFormState(buildCreateFormFromDay(new Date(), defaultMemberId));
    setFormError(null);
  };

  const openEditModal = (event: ScheduleEvent) => {
    setModalState({ mode: 'edit', eventId: event.id });
    setFormState(buildFormFromEvent(event));
    setFormError(null);
  };

  const applyOptimisticEventValues = (event: ScheduleEvent, payload: EventUpsertPayload): ScheduleEvent => {
    const targetMember = members.find((member) => member.id === payload.memberId);

    return {
      ...event,
      title: payload.title,
      startAt: payload.startAt,
      endAt: payload.endAt,
      isAllDay: payload.isAllDay,
      location: payload.location || null,
      description: payload.description || null,
      memberId: payload.memberId || event.memberId,
      memberName: targetMember?.name || event.memberName,
      source: 'manual',
    };
  };

  const handleCreate = async (payload: EventUpsertPayload) => {
    const member = members.find((item) => item.id === (payload.memberId || ''));
    const tempId = `temp-${Date.now()}`;
    const optimisticEvent: ScheduleEvent = {
      id: tempId,
      householdId,
      memberId: payload.memberId || member?.id || '',
      memberName: member?.name || 'Member',
      title: payload.title,
      startAt: payload.startAt,
      endAt: payload.endAt,
      isAllDay: payload.isAllDay,
      location: payload.location || null,
      description: payload.description || null,
      source: 'manual',
    };

    setEvents((previous) => sortEvents([...previous, optimisticEvent]));
    closeModal();

    try {
      const createdEvent = await createManualEvent(payload);
      setEvents((previous) =>
        sortEvents(previous.map((event) => (event.id === tempId ? { ...event, ...createdEvent } : event))),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create event.';
      setEvents((previous) => previous.filter((event) => event.id !== tempId));
      setError(message);
    }
  };

  const handleUpdate = async (eventId: string, payload: EventUpsertPayload) => {
    const existing = events.find((event) => event.id === eventId);
    if (!existing) {
      setError('Event no longer exists in current view.');
      return;
    }

    const optimistic = applyOptimisticEventValues(existing, payload);
    setEvents((previous) => sortEvents(previous.map((event) => (event.id === eventId ? optimistic : event))));
    closeModal();

    try {
      const updatedEvent = await updateScheduleEvent(eventId, payload);
      setEvents((previous) =>
        sortEvents(previous.map((event) => (event.id === eventId ? { ...event, ...updatedEvent } : event))),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update event.';
      setEvents((previous) => sortEvents(previous.map((event) => (event.id === eventId ? existing : event))));
      setError(message);
    }
  };

  const handleDelete = async (eventId: string) => {
    const existing = events.find((event) => event.id === eventId);
    if (!existing) {
      return;
    }

    setIsDeleting(true);
    setEvents((previous) => previous.filter((event) => event.id !== eventId));
    closeModal();

    try {
      await deleteScheduleEvent(eventId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete event.';
      setEvents((previous) => sortEvents([...previous, existing]));
      setError(message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!modalState || !formState) {
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError(null);

      const payload = normalizeFormIntoPayload(formState);

      if (modalState.mode === 'create') {
        await handleCreate(payload);
      } else if (modalState.eventId) {
        await handleUpdate(modalState.eventId, payload);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Please correct form values and try again.';
      setFormError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const changeMonth = (step: number) => {
    setMonthCursor((previous) => new Date(previous.getFullYear(), previous.getMonth() + step, 1));
  };

  return (
    <main className="calendar-screen">
      <section className="calendar-hero">
        <div>
          <p className="calendar-eyebrow">Schedule</p>
          <h1>Household Calendar</h1>
          <p className="calendar-subtitle">
            Manual and synced events in one shared calendar. Click an empty day to add an event.
          </p>
        </div>

        <div className="calendar-hero-actions">
          <Link to="/settings" className="btn btn-secondary">
            Settings
          </Link>
          <button type="button" className="btn btn-primary" onClick={openCreateModalNow}>
            Add Event
          </button>
        </div>
      </section>

      <section className="calendar-toolbar">
        <div className="toolbar-left">
          <button type="button" className="btn btn-secondary" onClick={() => changeMonth(-1)}>
            Prev
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => setMonthCursor(new Date())}>
            Today
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => changeMonth(1)}>
            Next
          </button>
        </div>

        <strong className="month-label">{formatMonthLabel(monthCursor)}</strong>
      </section>

      {isLoading ? <div className="state-box">Loading household calendar...</div> : null}
      {error ? (
        <div className="state-box state-error" role="alert">
          <p>{error}</p>
          <button type="button" className="btn btn-secondary" onClick={() => void loadSchedule()}>
            Retry
          </button>
        </div>
      ) : null}

      {!isLoading ? (
        <section className="calendar-grid">
          {WEEKDAY_LABELS.map((label) => (
            <div key={label} className="weekday-cell">
              {label}
            </div>
          ))}

          {calendarDays.map((day) => {
            const key = toDayKey(day.getTime());
            const dayEvents = eventsByDay.get(key) || [];
            const isCurrentMonth = day.getMonth() === monthCursor.getMonth();

            return (
              <div
                key={key}
                className={`day-cell ${isCurrentMonth ? '' : 'day-cell-muted'}`}
                role="button"
                tabIndex={0}
                onClick={() => openCreateModalForDay(day)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    openCreateModalForDay(day);
                  }
                }}
              >
                <div className="day-cell-head">
                  <span>{day.getDate()}</span>
                </div>

                <ul className="day-event-list">
                  {dayEvents.slice(0, 4).map((calendarEvent) => (
                    <li key={calendarEvent.id}>
                      <button
                        type="button"
                        className={`event-chip ${calendarEvent.source === 'manual' ? 'event-manual' : 'event-synced'}`}
                        onClick={(clickEvent) => {
                          clickEvent.stopPropagation();
                          openEditModal(calendarEvent);
                        }}
                        title={calendarEvent.title}
                      >
                        <span className="event-title">{calendarEvent.title}</span>
                        <span className="event-source">{calendarEvent.source}</span>
                      </button>
                    </li>
                  ))}

                  {dayEvents.length > 4 ? <li className="event-more">+{dayEvents.length - 4} more</li> : null}
                </ul>
              </div>
            );
          })}
        </section>
      ) : null}

      {modalState && formState ? (
        <div className="modal-overlay" role="presentation" onClick={closeModal}>
          <section className="modal-panel event-modal" role="dialog" onClick={(event) => event.stopPropagation()}>
            <h2>{modalState.mode === 'create' ? 'Add Event' : 'Edit Event'}</h2>

            <form className="modal-form" onSubmit={handleSubmit}>
              <label className="modal-label" htmlFor="event-title">
                Title
              </label>
              <input
                id="event-title"
                className="modal-input"
                type="text"
                value={formState.title}
                onChange={(event) => setFormState({ ...formState, title: event.target.value })}
                placeholder="School pickup, dentist appointment..."
                required
              />

              <label className="modal-label" htmlFor="event-member">
                Assign To
              </label>
              <select
                id="event-member"
                className="modal-input"
                value={formState.memberId}
                onChange={(event) => setFormState({ ...formState, memberId: event.target.value })}
              >
                <option value="">Current member</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>

              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={formState.isAllDay}
                  onChange={(event) => {
                    const nextAllDay = event.target.checked;
                    const nextStartInput = nextAllDay
                      ? formState.startInput.slice(0, 10)
                      : `${formState.startInput.slice(0, 10)}T09:00`;
                    const nextEndInput = nextAllDay
                      ? formState.endInput.slice(0, 10)
                      : `${formState.endInput.slice(0, 10)}T10:00`;

                    setFormState({
                      ...formState,
                      isAllDay: nextAllDay,
                      startInput: nextStartInput,
                      endInput: nextEndInput,
                    });
                  }}
                />
                <span>All day</span>
              </label>

              <div className="time-grid">
                <div>
                  <label className="modal-label" htmlFor="event-start">
                    Start
                  </label>
                  <input
                    id="event-start"
                    className="modal-input"
                    type={formState.isAllDay ? 'date' : 'datetime-local'}
                    value={formState.startInput}
                    onChange={(event) => setFormState({ ...formState, startInput: event.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="modal-label" htmlFor="event-end">
                    End
                  </label>
                  <input
                    id="event-end"
                    className="modal-input"
                    type={formState.isAllDay ? 'date' : 'datetime-local'}
                    value={formState.endInput}
                    onChange={(event) => setFormState({ ...formState, endInput: event.target.value })}
                    required
                  />
                </div>
              </div>

              <label className="modal-label" htmlFor="event-location">
                Location
              </label>
              <input
                id="event-location"
                className="modal-input"
                type="text"
                value={formState.location}
                onChange={(event) => setFormState({ ...formState, location: event.target.value })}
              />

              <label className="modal-label" htmlFor="event-description">
                Notes
              </label>
              <textarea
                id="event-description"
                className="modal-input modal-textarea"
                value={formState.description}
                onChange={(event) => setFormState({ ...formState, description: event.target.value })}
              />

              {activeEvent ? (
                <p className="event-meta">
                  Source: <strong>{activeEvent.source}</strong> | Start: {formatVisibleDate(activeEvent.startAt)}
                </p>
              ) : null}

              {formError ? <p className="form-error">{formError}</p> : null}

              <div className="modal-actions">
                {modalState.mode === 'edit' && modalState.eventId ? (
                  <button
                    type="button"
                    className="btn btn-danger"
                    disabled={isSubmitting || isDeleting}
                    onClick={() => void handleDelete(modalState.eventId!)}
                  >
                    Delete
                  </button>
                ) : null}
                <button type="button" className="btn btn-secondary" onClick={closeModal} disabled={isSubmitting}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting || isDeleting}>
                  {isSubmitting ? 'Saving...' : modalState.mode === 'create' ? 'Create Event' : 'Save Changes'}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </main>
  );
};

export default CalendarPage;
