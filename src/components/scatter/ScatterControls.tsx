import { CATEGORICAL_FIELDS, NUMERIC_FIELDS } from './fields'
import { FIXED_SIZE_ID, NO_COLOR_ID } from './types'
import type { ScatterConfig } from './types'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface ScatterControlsProps {
  config: ScatterConfig
  onChange: (next: ScatterConfig) => void
}

export function ScatterControls({ config, onChange }: ScatterControlsProps) {
  return (
    <div className="flex flex-wrap items-end gap-3 px-6 py-3">
      <ControlField label="X axis">
        <NumericSelect
          value={config.xId}
          onChange={(xId) => onChange({ ...config, xId })}
        />
      </ControlField>
      <ControlField label="Y axis">
        <NumericSelect
          value={config.yId}
          onChange={(yId) => onChange({ ...config, yId })}
        />
      </ControlField>
      <ControlField label="Color">
        <ColorSelect
          value={config.colorId}
          onChange={(colorId) => onChange({ ...config, colorId })}
        />
      </ControlField>
      <ControlField label="Size">
        <SizeSelect
          value={config.sizeId}
          onChange={(sizeId) => onChange({ ...config, sizeId })}
        />
      </ControlField>
    </div>
  )
}

function ControlField({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex min-w-[140px] flex-col gap-1.5">
      <label className="text-muted-foreground text-[10px] font-medium tracking-[0.08em] uppercase">
        {label}
      </label>
      {children}
    </div>
  )
}

function NumericSelect({
  value,
  onChange,
}: {
  value: string
  onChange: (id: string) => void
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 w-full text-[12px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {NUMERIC_FIELDS.map((f) => (
          <SelectItem key={f.id} value={f.id}>
            {f.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function ColorSelect({
  value,
  onChange,
}: {
  value: string
  onChange: (id: string) => void
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 w-full text-[12px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_COLOR_ID}>None</SelectItem>
        {CATEGORICAL_FIELDS.map((f) => (
          <SelectItem key={f.id} value={f.id}>
            {f.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function SizeSelect({
  value,
  onChange,
}: {
  value: string
  onChange: (id: string) => void
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 w-full text-[12px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={FIXED_SIZE_ID}>Fixed</SelectItem>
        {NUMERIC_FIELDS.map((f) => (
          <SelectItem key={f.id} value={f.id}>
            {f.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
