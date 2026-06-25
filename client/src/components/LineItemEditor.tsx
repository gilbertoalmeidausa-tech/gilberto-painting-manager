import { useFieldArray, useFormContext } from 'react-hook-form'
import { Trash2, Plus } from 'lucide-react'
import { formatCents } from '../lib/formatters'

export interface LineItem {
  id: string
  description: string
  quantity: number
  unit: string
  unitPriceCents: number
  totalCents: number
}

interface LineItemEditorProps {
  name: string
  onTotalsChange?: (subtotal: number) => void
  disabled?: boolean
}

export function LineItemEditor({ name, onTotalsChange, disabled }: LineItemEditorProps) {
  const { register, control, watch, setValue } = useFormContext()
  const { fields, append, remove } = useFieldArray({ control, name })

  const items: LineItem[] = watch(name) ?? []

  function recalcLine(index: number) {
    const item = items[index]
    if (!item) return
    const qty = Number(item.quantity) || 0
    const price = Number(item.unitPriceCents) || 0
    const total = Math.round(qty * price)
    setValue(`${name}.${index}.totalCents`, total)

    if (onTotalsChange) {
      const subtotal = items.reduce((sum, it, i) => {
        const t = i === index ? total : (Number(it.totalCents) || 0)
        return sum + t
      }, 0)
      onTotalsChange(subtotal)
    }
  }

  function addLine() {
    append({
      id: crypto.randomUUID(),
      description: '',
      quantity: 1,
      unit: '',
      unitPriceCents: 0,
      totalCents: 0,
    })
  }

  return (
    <div className="space-y-2">
      <div className="hidden md:grid md:grid-cols-12 gap-2 px-2 text-xs font-medium text-gray-500 uppercase">
        <div className="col-span-5">Description</div>
        <div className="col-span-2">Qty</div>
        <div className="col-span-1">Unit</div>
        <div className="col-span-2">Unit Price</div>
        <div className="col-span-1">Total</div>
        <div className="col-span-1" />
      </div>

      {fields.map((field, index) => (
        <div key={field.id} className="grid grid-cols-12 gap-2 items-center">
          <div className="col-span-12 md:col-span-5">
            <input
              {...register(`${name}.${index}.description`)}
              placeholder="Description"
              disabled={disabled}
              className="input"
            />
          </div>
          <div className="col-span-4 md:col-span-2">
            <input
              {...register(`${name}.${index}.quantity`, { valueAsNumber: true })}
              type="number"
              min="0"
              step="0.01"
              placeholder="1"
              disabled={disabled}
              onChange={(e) => { register(`${name}.${index}.quantity`).onChange(e); recalcLine(index) }}
              className="input"
            />
          </div>
          <div className="col-span-4 md:col-span-1">
            <input
              {...register(`${name}.${index}.unit`)}
              placeholder="ea"
              disabled={disabled}
              className="input"
            />
          </div>
          <div className="col-span-4 md:col-span-2">
            <input
              {...register(`${name}.${index}.unitPriceCents`, { valueAsNumber: true })}
              type="number"
              min="0"
              step="1"
              placeholder="0"
              disabled={disabled}
              onChange={(e) => { register(`${name}.${index}.unitPriceCents`).onChange(e); recalcLine(index) }}
              className="input"
            />
          </div>
          <div className="col-span-11 md:col-span-1 text-sm font-medium text-gray-700">
            {formatCents(Number(items[index]?.totalCents) || 0)}
          </div>
          <div className="col-span-1 flex justify-end">
            {!disabled && (
              <button
                type="button"
                onClick={() => { remove(index); if (onTotalsChange) { const sub = items.filter((_, i) => i !== index).reduce((s, it) => s + (Number(it.totalCents) || 0), 0); onTotalsChange(sub) } }}
                className="rounded p-1 text-gray-400 hover:text-red-500"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      ))}

      {!disabled && (
        <button type="button" onClick={addLine} className="btn-secondary text-sm mt-2">
          <Plus className="h-4 w-4" />
          Add Line Item
        </button>
      )}

      {fields.length === 0 && (
        <p className="text-sm text-gray-400 py-2">No line items yet.</p>
      )}
    </div>
  )
}
