"use client";

import { MODELS, PROVIDER_LABELS, getModelsByProvider } from "@/lib/models";

interface ModelSelectorProps {
  value: string;
  onChange: (modelId: string) => void;
}

export function ModelSelector({ value, onChange }: ModelSelectorProps) {
  const grouped = getModelsByProvider();

  return (
    <select
      className="model-select"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {Object.entries(grouped).map(([provider, models]) => (
        <optgroup key={provider} label={PROVIDER_LABELS[provider] || provider}>
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
