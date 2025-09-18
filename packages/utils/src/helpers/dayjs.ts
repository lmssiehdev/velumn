/** biome-ignore-all lint/style/noExportedImports: <explanation> */
import dayjs, { type Dayjs } from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

export { dayjs, type Dayjs };
