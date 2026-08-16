import { useState, type ComponentType } from 'react';
import { ChevronsUpDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SectionHeading } from '../components/SectionHeading';
import { ResourceCard } from '../components/ResourceCard';
import { useApiDocsTableGroups } from '../useApiDocsTableGroups';

export function ResourceReference() {
  const { t } = useTranslation('apiDocs');
  const TABLE_GROUPS = useApiDocsTableGroups();
  const [allExpanded, setAllExpanded] = useState(false);
  const [key, setKey] = useState(0);

  const toggleAll = () => {
    setAllExpanded(!allExpanded);
    setKey((k) => k + 1);
  };

  return (
    <section>
      {TABLE_GROUPS.map(({ anchorId, group, icon: GroupIcon, tables }) => {
        return (
          <div key={anchorId} className="mb-12">
            <div className="flex items-center justify-between mb-6">
              <SectionHeading
                id={anchorId}
                level="h3"
                icon={GroupIcon as ComponentType<{ className?: string }>}
                className="mb-0"
              >
                {group}
              </SectionHeading>
              {anchorId === TABLE_GROUPS[0].anchorId && (
                <button
                  type="button"
                  onClick={toggleAll}
                  className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-white transition-colors"
                >
                  <ChevronsUpDown className="h-3 w-3" />
                  {allExpanded ? t('reference.collapseAll') : t('reference.expandAll')}
                </button>
              )}
            </div>
            <div className="space-y-4">
              {tables.map((table) => (
                <div key={`${table.name}-${key}`} id={`resource-${table.name}`} className="scroll-mt-28">
                  <ResourceCard
                    table={table}
                    defaultExpanded={allExpanded}
                  />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}
