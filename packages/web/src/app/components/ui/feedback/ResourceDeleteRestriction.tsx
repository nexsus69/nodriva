/** Renders ACL-filtered referencers without mixing technical identifiers into the main error text. */
import type { ResourceDeleteRestriction as ResourceDeleteRestrictionModel } from '../../../errors/resourceDeleteError';

export function ResourceDeleteRestriction({ restriction }: { restriction: ResourceDeleteRestrictionModel }) {
  return (
    <div className="mt-2 space-y-1" data-resource-delete-restriction="true">
      <p>Riferimenti attivi: {restriction.totalReferencerCount}.</p>
      {restriction.referencers.length > 0 && (
        <div>
          <p className="font-semibold">Referenzianti visibili:</p>
          <ul className="list-disc pl-5">
            {restriction.referencers.map((referencer) => (
              <li key={`${referencer.type}:${referencer.id}`}>
                {referencer.name} ({referencer.type}) — ID: <code>{referencer.id}</code>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
