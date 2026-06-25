import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'

const S = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 10, padding: 48, color: '#111827' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 32 },
  companyName: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#e86010' },
  tableHeader: { flexDirection: 'row', backgroundColor: '#f9fafb', padding: '6 8', borderBottom: '1 solid #e5e7eb' },
  tableRow: { flexDirection: 'row', padding: '6 8', borderBottom: '1 solid #f3f4f6' },
  col1: { flex: 3 },
  col2: { flex: 1, textAlign: 'right' },
  col3: { flex: 1, textAlign: 'right' },
  col4: { flex: 1, textAlign: 'right' },
  totalRow: { flexDirection: 'row', width: 220, marginBottom: 3 },
  totalLabel: { flex: 1, color: '#6b7280' },
  totalValue: { width: 80, textAlign: 'right' },
  finalRow: { flexDirection: 'row', width: 220, borderTop: '1 solid #111827', paddingTop: 4, marginTop: 4 },
  finalLabel: { flex: 1, fontFamily: 'Helvetica-Bold', fontSize: 12 },
  finalValue: { width: 80, textAlign: 'right', fontFamily: 'Helvetica-Bold', fontSize: 12 },
})

function cents(v: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v / 100)
}

interface InvoicePdfProps {
  invoice: {
    invoiceNumber: string; status: string
    lineItems: string; subtotalCents: number; taxRateCents: number
    taxAmountCents: number; discountAmountCents: number; totalCents: number
    amountPaidCents: number; amountDueCents: number
    dueDate: string | null; paidAt: string | null; notes: string | null; createdAt: string
    project: { name: string; client: { name: string; address: string | null; city: string | null; state: string | null } | null } | null
  }
  logoUrl?: string
}

export function InvoicePdf({ invoice, logoUrl }: InvoicePdfProps) {
  const lineItems = JSON.parse(invoice.lineItems || '[]') as Array<{
    description: string; quantity: number; unit: string; unitPriceCents: number; totalCents: number
  }>
  const client = invoice.project?.client
  const date = new Date(invoice.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const dueDate = invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : null
  const paidDate = invoice.paidAt ? new Date(invoice.paidAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : null

  return (
    <Document>
      <Page size="LETTER" style={S.page}>
        {/* Header */}
        <View style={S.header}>
          <View>
            {logoUrl && !logoUrl.endsWith('.svg') ? (
              <Image src={logoUrl} style={{ width: 100, height: 36, objectFit: 'contain', marginBottom: 2 }} />
            ) : (
              <Text style={S.companyName}>Gilberto Pro Painting</Text>
            )}
            <Text style={{ color: '#6b7280', fontSize: 9, marginTop: 2 }}>857-505-6448 · gilbertopropainting.com</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 18, color: '#374151' }}>INVOICE</Text>
            <Text style={{ color: '#6b7280', fontSize: 9, marginTop: 2 }}>{invoice.invoiceNumber}</Text>
          </View>
        </View>

        {/* Info */}
        <View style={{ flexDirection: 'row', marginBottom: 28 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 11, marginBottom: 6, borderBottom: '1 solid #e5e7eb', paddingBottom: 4 }}>Invoice Details</Text>
            <View style={{ flexDirection: 'row', marginBottom: 2 }}><Text style={{ width: 80, color: '#6b7280' }}>Invoice #:</Text><Text>{invoice.invoiceNumber}</Text></View>
            <View style={{ flexDirection: 'row', marginBottom: 2 }}><Text style={{ width: 80, color: '#6b7280' }}>Date:</Text><Text>{date}</Text></View>
            {dueDate && <View style={{ flexDirection: 'row', marginBottom: 2 }}><Text style={{ width: 80, color: '#6b7280' }}>Due Date:</Text><Text>{dueDate}</Text></View>}
            <View style={{ flexDirection: 'row', marginBottom: 2 }}><Text style={{ width: 80, color: '#6b7280' }}>Status:</Text><Text style={{ fontFamily: 'Helvetica-Bold', color: invoice.status === 'paid' ? '#16a34a' : '#d97706' }}>{invoice.status.toUpperCase()}</Text></View>
            {paidDate && <View style={{ flexDirection: 'row' }}><Text style={{ width: 80, color: '#6b7280' }}>Paid:</Text><Text style={{ color: '#16a34a' }}>{paidDate}</Text></View>}
          </View>
          {client && (
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 11, marginBottom: 6, borderBottom: '1 solid #e5e7eb', paddingBottom: 4 }}>Bill To</Text>
              <Text style={{ fontFamily: 'Helvetica-Bold' }}>{client.name}</Text>
              {client.address && <Text style={{ color: '#6b7280', marginTop: 2 }}>{client.address}</Text>}
              {(client.city || client.state) && <Text style={{ color: '#6b7280' }}>{[client.city, client.state].filter(Boolean).join(', ')}</Text>}
            </View>
          )}
        </View>

        {invoice.project && (
          <Text style={{ color: '#6b7280', marginBottom: 16 }}>Project: {invoice.project.name}</Text>
        )}

        {/* Line Items */}
        <View style={{ marginBottom: 8 }}>
          <View style={S.tableHeader}>
            <Text style={[S.col1, { fontFamily: 'Helvetica-Bold' }]}>Description</Text>
            <Text style={[S.col2, { fontFamily: 'Helvetica-Bold' }]}>Qty</Text>
            <Text style={[S.col3, { fontFamily: 'Helvetica-Bold' }]}>Unit Price</Text>
            <Text style={[S.col4, { fontFamily: 'Helvetica-Bold' }]}>Total</Text>
          </View>
          {lineItems.map((item, i) => (
            <View key={i} style={S.tableRow}>
              <Text style={S.col1}>{item.description}</Text>
              <Text style={S.col2}>{item.quantity}</Text>
              <Text style={S.col3}>{cents(item.unitPriceCents)}</Text>
              <Text style={S.col4}>{cents(item.totalCents)}</Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={{ alignItems: 'flex-end', marginTop: 12 }}>
          <View style={S.totalRow}>
            <Text style={S.totalLabel}>Subtotal</Text>
            <Text style={S.totalValue}>{cents(invoice.subtotalCents)}</Text>
          </View>
          {invoice.taxAmountCents > 0 && (
            <View style={S.totalRow}>
              <Text style={S.totalLabel}>Tax ({(invoice.taxRateCents / 100).toFixed(2)}%)</Text>
              <Text style={S.totalValue}>{cents(invoice.taxAmountCents)}</Text>
            </View>
          )}
          {invoice.discountAmountCents > 0 && (
            <View style={S.totalRow}>
              <Text style={S.totalLabel}>Discount</Text>
              <Text style={S.totalValue}>-{cents(invoice.discountAmountCents)}</Text>
            </View>
          )}
          <View style={S.finalRow}>
            <Text style={S.finalLabel}>Total</Text>
            <Text style={S.finalValue}>{cents(invoice.totalCents)}</Text>
          </View>
          {invoice.amountPaidCents > 0 && (
            <View style={{ ...S.totalRow, marginTop: 8 }}>
              <Text style={{ ...S.totalLabel, color: '#16a34a' }}>Amount Paid</Text>
              <Text style={{ ...S.totalValue, color: '#16a34a' }}>{cents(invoice.amountPaidCents)}</Text>
            </View>
          )}
          {invoice.amountDueCents > 0 && (
            <View style={{ ...S.totalRow }}>
              <Text style={{ ...S.totalLabel, color: '#d97706', fontFamily: 'Helvetica-Bold' }}>Amount Due</Text>
              <Text style={{ ...S.totalValue, color: '#d97706', fontFamily: 'Helvetica-Bold' }}>{cents(invoice.amountDueCents)}</Text>
            </View>
          )}
        </View>

        {/* Notes */}
        {invoice.notes && (
          <View style={{ marginTop: 24, padding: 12, backgroundColor: '#f9fafb' }}>
            <Text style={{ fontFamily: 'Helvetica-Bold', marginBottom: 4 }}>Notes</Text>
            <Text style={{ color: '#374151' }}>{invoice.notes}</Text>
          </View>
        )}

        <View style={{ position: 'absolute', bottom: 30, left: 48, right: 48 }}>
          <Text style={{ fontSize: 8, color: '#9ca3af', textAlign: 'center' }}>
            Thank you for your business! · Gilberto Pro Painting · 857-505-6448 · gilbertopropainting.com
          </Text>
        </View>
      </Page>
    </Document>
  )
}
