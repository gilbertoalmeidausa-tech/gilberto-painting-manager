import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 10, padding: 48, color: '#111827' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 32 },
  companyName: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#e86010' },
  title: { fontSize: 22, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  subtitle: { fontSize: 12, color: '#6b7280', marginBottom: 24 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', marginBottom: 8, borderBottom: '1 solid #e5e7eb', paddingBottom: 4 },
  row: { flexDirection: 'row', marginBottom: 2 },
  label: { width: 90, color: '#6b7280' },
  value: { flex: 1 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#f9fafb', padding: '6 8', borderBottom: '1 solid #e5e7eb' },
  tableRow: { flexDirection: 'row', padding: '6 8', borderBottom: '1 solid #f3f4f6' },
  col1: { flex: 3 },
  col2: { flex: 1, textAlign: 'right' },
  col3: { flex: 1, textAlign: 'right' },
  col4: { flex: 1, textAlign: 'right' },
  col5: { flex: 1, textAlign: 'right' },
  totals: { marginTop: 12, alignItems: 'flex-end' },
  totalRow: { flexDirection: 'row', width: 220, marginBottom: 3 },
  totalLabel: { flex: 1, color: '#6b7280' },
  totalValue: { width: 80, textAlign: 'right' },
  totalFinal: { flexDirection: 'row', width: 220, borderTop: '1 solid #111827', paddingTop: 4, marginTop: 4 },
  totalFinalLabel: { flex: 1, fontFamily: 'Helvetica-Bold', fontSize: 12 },
  totalFinalValue: { width: 80, textAlign: 'right', fontFamily: 'Helvetica-Bold', fontSize: 12 },
  notes: { marginTop: 24, padding: 12, backgroundColor: '#f9fafb', borderRadius: 4 },
  badge: { fontSize: 9, padding: '2 6', borderRadius: 4, backgroundColor: '#e5e7eb', color: '#374151' },
})

function cents(v: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v / 100)
}

interface ProposalPdfProps {
  proposal: {
    proposalNumber: string; title: string; status: string
    lineItems: string; subtotalCents: number; taxRateCents: number
    taxAmountCents: number; discountAmountCents: number; totalCents: number
    notes: string | null; validUntil: string | null; createdAt: string
    project: { name: string; client: { name: string; address: string | null; city: string | null; state: string | null } | null } | null
  }
  logoUrl?: string
}

export function ProposalPdf({ proposal, logoUrl }: ProposalPdfProps) {
  const lineItems = JSON.parse(proposal.lineItems || '[]') as Array<{
    description: string; quantity: number; unit: string; unitPriceCents: number; totalCents: number
  }>
  const client = proposal.project?.client
  const date = new Date(proposal.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const validUntil = proposal.validUntil ? new Date(proposal.validUntil).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : null

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            {logoUrl && !logoUrl.endsWith('.svg') ? (
              <Image src={logoUrl} style={{ width: 100, height: 36, objectFit: 'contain', marginBottom: 2 }} />
            ) : (
              <Text style={styles.companyName}>Gilberto Pro Painting</Text>
            )}
            <Text style={{ color: '#6b7280', fontSize: 9, marginTop: 2 }}>857-505-6448 · gilbertopropainting.com</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 18, color: '#374151' }}>PROPOSAL</Text>
            <Text style={{ color: '#6b7280', fontSize: 9, marginTop: 2 }}>{proposal.proposalNumber}</Text>
          </View>
        </View>

        {/* Proposal Info + Client */}
        <View style={{ flexDirection: 'row', marginBottom: 28 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>Proposal Details</Text>
            <View style={styles.row}><Text style={styles.label}>Date:</Text><Text style={styles.value}>{date}</Text></View>
            {validUntil && <View style={styles.row}><Text style={styles.label}>Valid Until:</Text><Text style={styles.value}>{validUntil}</Text></View>}
            <View style={styles.row}><Text style={styles.label}>Status:</Text><Text style={styles.value}>{proposal.status.toUpperCase()}</Text></View>
          </View>
          {client && (
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>Client</Text>
              <Text style={{ fontFamily: 'Helvetica-Bold' }}>{client.name}</Text>
              {client.address && <Text style={{ color: '#6b7280', marginTop: 2 }}>{client.address}</Text>}
              {(client.city || client.state) && <Text style={{ color: '#6b7280' }}>{[client.city, client.state].filter(Boolean).join(', ')}</Text>}
            </View>
          )}
        </View>

        {/* Title */}
        <Text style={styles.title}>{proposal.title}</Text>
        {proposal.project && <Text style={{ color: '#6b7280', marginBottom: 20 }}>Project: {proposal.project.name}</Text>}

        {/* Line Items */}
        <View style={styles.section}>
          <View style={styles.tableHeader}>
            <Text style={[styles.col1, { fontFamily: 'Helvetica-Bold' }]}>Description</Text>
            <Text style={[styles.col2, { fontFamily: 'Helvetica-Bold' }]}>Qty</Text>
            <Text style={[styles.col3, { fontFamily: 'Helvetica-Bold' }]}>Unit</Text>
            <Text style={[styles.col4, { fontFamily: 'Helvetica-Bold' }]}>Unit Price</Text>
            <Text style={[styles.col5, { fontFamily: 'Helvetica-Bold' }]}>Total</Text>
          </View>
          {lineItems.map((item, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={styles.col1}>{item.description}</Text>
              <Text style={styles.col2}>{item.quantity}</Text>
              <Text style={styles.col3}>{item.unit}</Text>
              <Text style={styles.col4}>{cents(item.unitPriceCents)}</Text>
              <Text style={styles.col5}>{cents(item.totalCents)}</Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>{cents(proposal.subtotalCents)}</Text>
          </View>
          {proposal.taxAmountCents > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Tax ({(proposal.taxRateCents / 100).toFixed(2)}%)</Text>
              <Text style={styles.totalValue}>{cents(proposal.taxAmountCents)}</Text>
            </View>
          )}
          {proposal.discountAmountCents > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Discount</Text>
              <Text style={styles.totalValue}>-{cents(proposal.discountAmountCents)}</Text>
            </View>
          )}
          <View style={styles.totalFinal}>
            <Text style={styles.totalFinalLabel}>Total</Text>
            <Text style={styles.totalFinalValue}>{cents(proposal.totalCents)}</Text>
          </View>
        </View>

        {/* Notes */}
        {proposal.notes && (
          <View style={styles.notes}>
            <Text style={{ fontFamily: 'Helvetica-Bold', marginBottom: 4 }}>Notes</Text>
            <Text style={{ color: '#374151' }}>{proposal.notes}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={{ position: 'absolute', bottom: 30, left: 48, right: 48 }}>
          <Text style={{ fontSize: 8, color: '#9ca3af', textAlign: 'center' }}>
            This proposal is valid until {validUntil ?? 'further notice'}. To accept, please contact us.
          </Text>
        </View>
      </Page>
    </Document>
  )
}
