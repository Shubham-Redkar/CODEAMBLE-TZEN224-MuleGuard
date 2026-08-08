type RuleTrigger = {
  id: string;
  description: string;
  condition: string;
  computed_value: number;
  threshold: number;
  points: number;
  contributing_row_ids: string[];
};

type RuleTriggerListProps = {
  rules: RuleTrigger[];
};

export function RuleTriggerList({ rules }: RuleTriggerListProps) {
  if (rules.length === 0) {
    return <div className="text-sm text-gray-400 italic">No rules triggered.</div>;
  }

  const sorted = [...rules].sort((a, b) => b.points - a.points);

  return (
    <div className="space-y-2">
      {sorted.map((r) => (
        <div key={r.id} className="rounded-lg border border-red-100 bg-red-50 p-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-bold text-red-700">{r.id}</span>
            <span className="text-xs font-bold text-red-600">+{r.points} pts</span>
          </div>
          <p className="text-sm mt-1">{r.description}</p>
          <div className="flex gap-4 mt-1 text-xs text-gray-500">
            <span>Value: {r.computed_value.toFixed(3)}</span>
            <span>Threshold: {r.threshold}</span>
          </div>
          {r.contributing_row_ids.length > 0 && (
            <div className="mt-1 text-xs text-gray-400">
              {r.contributing_row_ids.length} contributing transaction(s)
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
