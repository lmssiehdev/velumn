import { dayjs } from './dayjs';
import { getDateFromSnowflake as snowflakeToDate } from './snowflake';

export function snowflakeToReadableDate(snowflake: string) {
  const date = snowflakeToDate(snowflake);
  const now = dayjs();
  const messageDate = dayjs(date);

  // For messages from today, show relative time
  if (messageDate.isSame(now, 'day')) {
    return messageDate.fromNow();
  }

  // For yesterday, show "Yesterday at HH:mm AM/PM"
  if (messageDate.isSame(now.subtract(1, 'day'), 'day')) {
    return `Yesterday at ${messageDate.format('h:mm A')}`;
  }

  // For older messages, fall back to fromNow() or custom format
  return messageDate.fromNow();
}
