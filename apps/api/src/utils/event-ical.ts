import ical, { ICalCalendarMethod } from 'ical-generator'
import type { Event } from '@wishly/db'

export function buildIcs(event: Event, hostName: string, publicUrl: string): string {
  const cal = ical({
    name: `Wishly · ${event.title}`,
    prodId: { company: 'Wishly', product: 'Events', language: 'RU' },
    method: ICalCalendarMethod.PUBLISH,
  })

  cal.createEvent({
    id: event.id,
    start: event.startsAt,
    end: event.endsAt ?? new Date(event.startsAt.getTime() + 3 * 60 * 60 * 1000),
    summary: event.title,
    description: event.description ?? '',
    location: event.location ?? '',
    url: publicUrl,
    organizer: { name: hostName, email: 'noreply@wishly.app' },
    timezone: event.timezone,
  })

  return cal.toString()
}
