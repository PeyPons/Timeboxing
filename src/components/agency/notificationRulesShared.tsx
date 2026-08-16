import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { useAppTranslation } from '@/hooks/useAppTranslation';
import { type NotificationRule } from '@/types/notifications';
import type { ClientRow, ProjectRow } from '@/components/agency/notificationRulesConstants';

export function RuleScheduledScopeFilters({
  rule,
  clients,
  projects,
  updateLocal,
}: {
  rule: NotificationRule;
  clients: ClientRow[];
  projects: ProjectRow[];
  updateLocal: (id: string, patch: Partial<NotificationRule>) => void;
}) {
  const { t, i18n } = useAppTranslation();
  const tk = 'agency.notifications.rules';
  const [openClients, setOpenClients] = useState(false);
  const [openProjects, setOpenProjects] = useState(false);

  const selectedClientIds = rule.conditions.client_ids ?? [];
  const selectedProjectIds = rule.conditions.project_ids ?? [];

  const sortedClients = useMemo(
    () => [...clients].sort((a, b) => a.name.localeCompare(b.name, i18n.language || 'es')),
    [clients, i18n.language],
  );
  const sortedProjects = useMemo(
    () => [...projects].sort((a, b) => a.name.localeCompare(b.name, i18n.language || 'es')),
    [projects, i18n.language],
  );

  const toggleClient = (clientId: string) => {
    const set = new Set(selectedClientIds);
    if (set.has(clientId)) set.delete(clientId);
    else set.add(clientId);
    const next = [...set];
    updateLocal(rule.id, {
      conditions: {
        ...rule.conditions,
        client_ids: next.length ? next : undefined,
      },
    });
  };

  const toggleProject = (projectId: string) => {
    const set = new Set(selectedProjectIds);
    if (set.has(projectId)) set.delete(projectId);
    else set.add(projectId);
    const next = [...set];
    updateLocal(rule.id, {
      conditions: {
        ...rule.conditions,
        project_ids: next.length ? next : undefined,
      },
    });
  };

  const clearClients = () =>
    updateLocal(rule.id, { conditions: { ...rule.conditions, client_ids: undefined } });
  const clearProjects = () =>
    updateLocal(rule.id, { conditions: { ...rule.conditions, project_ids: undefined } });

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2">
        <Label>{t(`${tk}.clientsOptional`)}</Label>
        <Popover open={openClients} onOpenChange={setOpenClients}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="w-full justify-between font-normal"
              aria-expanded={openClients}
            >
              <span className="truncate text-left">
                {selectedClientIds.length === 0
                  ? t(`${tk}.allClients`)
                  : t(`${tk}.nClients`, { count: selectedClientIds.length })}
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
            <Command>
              <CommandInput placeholder={t(`${tk}.searchClient`)} />
              <CommandList>
                <CommandEmpty>{t(`${tk}.noCommandResults`)}</CommandEmpty>
                <CommandGroup>
                  {sortedClients.map((c) => {
                    const sel = selectedClientIds.includes(c.id);
                    return (
                      <CommandItem
                        key={c.id}
                        value={`${c.name} ${c.id}`}
                        onSelect={() => toggleClient(c.id)}
                      >
                        <Check className={cn('mr-2 h-4 w-4', sel ? 'opacity-100' : 'opacity-0')} />
                        {c.name}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
            {selectedClientIds.length > 0 ? (
              <div className="border-t p-2">
                <Button type="button" variant="ghost" size="sm" className="w-full" onClick={clearClients}>
                  {t(`${tk}.clearClientFilter`)}
                </Button>
              </div>
            ) : null}
          </PopoverContent>
        </Popover>
        <p className="text-xs text-muted-foreground">{t(`${tk}.clientFilterHint`)}</p>
      </div>
      <div className="space-y-2">
        <Label>{t(`${tk}.projectsOptional`)}</Label>
        <Popover open={openProjects} onOpenChange={setOpenProjects}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="w-full justify-between font-normal"
              aria-expanded={openProjects}
            >
              <span className="truncate text-left">
                {selectedProjectIds.length === 0
                  ? t(`${tk}.allProjects`)
                  : t(`${tk}.nProjects`, { count: selectedProjectIds.length })}
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
            <Command>
              <CommandInput placeholder={t(`${tk}.searchProject`)} />
              <CommandList>
                <CommandEmpty>{t(`${tk}.noCommandResults`)}</CommandEmpty>
                <CommandGroup>
                  {sortedProjects.map((p) => {
                    const sel = selectedProjectIds.includes(p.id);
                    return (
                      <CommandItem
                        key={p.id}
                        value={`${p.name} ${p.id}`}
                        onSelect={() => toggleProject(p.id)}
                      >
                        <Check className={cn('mr-2 h-4 w-4', sel ? 'opacity-100' : 'opacity-0')} />
                        {p.name}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
            {selectedProjectIds.length > 0 ? (
              <div className="border-t p-2">
                <Button type="button" variant="ghost" size="sm" className="w-full" onClick={clearProjects}>
                  {t(`${tk}.clearProjectFilter`)}
                </Button>
              </div>
            ) : null}
          </PopoverContent>
        </Popover>
        <p className="text-xs text-muted-foreground">{t(`${tk}.projectFilterHint`)}</p>
      </div>
    </div>
  );
}
