/** Renders ACL-filtered referencers without mixing technical identifiers into the main error text. */
import type { ResourceDeleteRestriction as ResourceDeleteRestrictionModel } from '../../../errors/resourceDeleteError';
import Link from '../../navigation/GuardedLink';
import { useAppLocale } from '@/app/i18n/AppLocaleStore';

export function ResourceDeleteRestriction({ restriction }: { restriction: ResourceDeleteRestrictionModel }) {
  const { t } = useAppLocale();
  return (
    <div className="mt-2 space-y-1" data-resource-delete-restriction="true">
      <p>{t('deleteRestriction.activeReferences')} {restriction.totalReferencerCount}.</p>
      {restriction.referencers.length > 0 && (
        <div>
          <p className="font-semibold">{t('deleteRestriction.visibleReferencers')}</p>
          <ul className="list-disc pl-5">
            {restriction.referencers.map((referencer) => (
              <li key={`${referencer.type}:${referencer.id}`}>
                {referencer.name} ({referencer.type}) — ID: <code>{referencer.id}</code>
                {referencer.href && <Link href={referencer.href} className="ml-2 underline">{t('common.open')}</Link>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
