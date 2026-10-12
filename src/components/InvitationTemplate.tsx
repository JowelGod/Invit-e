import { formatDateTime } from '../lib/dates';
import type { InviteeKind, PublicScheduleItem } from '../lib/types';

interface Props {
  title: string;
  timezone: string;
  schedule: PublicScheduleItem[];
  partyTitle: string;
  places: Array<{ key: string; name: string | null; type: InviteeKind }>;
}

export function InvitationTemplate({ title, timezone, schedule, partyTitle, places }: Props) {
  const orderedSchedule = [...schedule].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  return (
    <div className="invitation-template">
      <p className="eyebrow">Invitación para</p>
      <h1>{partyTitle}</h1>
      <div className="invitation-event">
        <h2>{title}</h2>
      </div>
      {orderedSchedule.length > 0 && (
        <section className="public-schedule" aria-label="Agenda del evento">
          <h2>Agenda</h2>
          <ol className="timeline">
            {orderedSchedule.map((item, index) => (
              <li key={`${item.starts_at}-${item.title}-${index}`}>
                <h3>{item.title}</h3>
                <p>{formatDateTime(item.starts_at, timezone)}</p>
                {(item.venue_name || item.address) && (
                  <p>{[item.venue_name, item.address].filter(Boolean).join(' · ')}</p>
                )}
                {item.description && <p>{item.description}</p>}
              </li>
            ))}
          </ol>
        </section>
      )}
      <section className="preview-guests" aria-label="Boletos incluidos">
        <h2>Boletos incluidos</h2>
        <ol>
          {places.map((place) => (
            <li key={place.key}>{place.name}</li>
          ))}
        </ol>
      </section>
    </div>
  );
}
