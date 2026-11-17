import { MAX_ERRORS } from '@/lib/game/state';
import { ICONS } from '@/lib/pixel/glyphs';
import { Pixel } from './Pixel';

/** Three small pixel crosses: grey while available, light red once used. */
export function Errors({ count }: { count: number }) {
  const used = Math.min(count, MAX_ERRORS);
  return (
    <span className="errors" role="img" aria-label={`${used} erreur${used > 1 ? 's' : ''} sur ${MAX_ERRORS}`}>
      {Array.from({ length: MAX_ERRORS }, (_, k) => (
        <Pixel key={k} rows={ICONS.cross} className={k < used ? 'used' : undefined} />
      ))}
    </span>
  );
}
