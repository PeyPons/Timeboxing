import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAppTranslation } from '@/hooks/useAppTranslation';

export function WeeklyOptionalNote({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const { t } = useAppTranslation();
  return (
    <div className="space-y-1 border-t pt-3">
      <Label className="text-xs font-medium text-muted-foreground">
        {t('weeklyReport.notes.optionalLabel')}
      </Label>
      <Textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={2}
        className="min-h-[48px] max-h-24 resize-y text-sm"
        placeholder={t('weeklyReport.notes.optionalPlaceholder')}
      />
    </div>
  );
}

export function WeeklyRequiredNote({
  value,
  onChange,
  placeholder,
  helperText,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  helperText?: string;
}) {
  const { t } = useAppTranslation();
  const resolvedPlaceholder = placeholder ?? t('weeklyReport.notes.requiredPlaceholder');
  const resolvedHelper = helperText ?? t('weeklyReport.notes.requiredHelperDefault');
  return (
    <div className="space-y-1">
      <Label className="text-xs font-medium">{t('weeklyReport.notes.requiredLabel')}</Label>
      <Textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={2}
        className="min-h-[48px] max-h-24 resize-y text-sm"
        placeholder={resolvedPlaceholder}
      />
      <p className="text-[11px] text-muted-foreground">{resolvedHelper}</p>
    </div>
  );
}
