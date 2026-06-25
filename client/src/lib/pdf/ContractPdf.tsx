import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'

const S = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 10, padding: 48, color: '#111827' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 32 },
  companyName: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#e86010' },
  h1: { fontSize: 18, fontFamily: 'Helvetica-Bold', marginBottom: 20 },
  h2: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginBottom: 8, marginTop: 16, color: '#374151' },
  body: { lineHeight: 1.6, color: '#374151' },
  infoGrid: { flexDirection: 'row', marginBottom: 24 },
  infoCol: { flex: 1 },
  label: { color: '#6b7280', marginBottom: 2 },
  value: { fontFamily: 'Helvetica-Bold', marginBottom: 8 },
  sigBlock: { flexDirection: 'row', marginTop: 32, gap: 32 },
  sigCol: { flex: 1 },
  sigLine: { borderBottom: '1 solid #374151', marginTop: 48, marginBottom: 4 },
})

interface ContractPdfProps {
  contract: {
    contractNumber: string; title: string; status: string
    scopeOfWork: string; paymentTerms: string; termsAndConditions: string
    signedByName: string | null; signedAt: string | null; createdAt: string
    project: { name: string; client: { name: string; address: string | null; city: string | null; state: string | null } | null } | null
    proposal: { proposalNumber: string } | null
  }
  logoUrl?: string
}

export function ContractPdf({ contract, logoUrl }: ContractPdfProps) {
  const client = contract.project?.client
  const date = new Date(contract.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const signedDate = contract.signedAt ? new Date(contract.signedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : null

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
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 18, color: '#374151' }}>CONTRACT</Text>
            <Text style={{ color: '#6b7280', fontSize: 9, marginTop: 2 }}>{contract.contractNumber}</Text>
          </View>
        </View>

        <Text style={S.h1}>{contract.title}</Text>

        {/* Info Grid */}
        <View style={S.infoGrid}>
          <View style={S.infoCol}>
            <Text style={S.label}>Date:</Text>
            <Text style={S.value}>{date}</Text>
            {contract.project && (
              <>
                <Text style={S.label}>Project:</Text>
                <Text style={S.value}>{contract.project.name}</Text>
              </>
            )}
            {contract.proposal && (
              <>
                <Text style={S.label}>Proposal Ref:</Text>
                <Text style={S.value}>{contract.proposal.proposalNumber}</Text>
              </>
            )}
          </View>
          {client && (
            <View style={S.infoCol}>
              <Text style={S.label}>Client:</Text>
              <Text style={S.value}>{client.name}</Text>
              {client.address && <Text style={{ color: '#6b7280' }}>{client.address}</Text>}
              {(client.city || client.state) && <Text style={{ color: '#6b7280' }}>{[client.city, client.state].filter(Boolean).join(', ')}</Text>}
            </View>
          )}
        </View>

        {/* Scope of Work */}
        {contract.scopeOfWork && (
          <>
            <Text style={S.h2}>Scope of Work</Text>
            <Text style={S.body}>{contract.scopeOfWork}</Text>
          </>
        )}

        {/* Terms & Conditions */}
        {contract.termsAndConditions && (
          <>
            <Text style={S.h2}>Terms & Conditions</Text>
            <Text style={S.body}>{contract.termsAndConditions}</Text>
          </>
        )}

        {/* Signatures */}
        <View style={S.sigBlock}>
          <View style={S.sigCol}>
            <Text style={{ fontFamily: 'Helvetica-Bold', marginBottom: 4 }}>Contractor</Text>
            <View style={S.sigLine} />
            <Text>Gilberto Pro Painting</Text>
            <Text style={{ color: '#6b7280', fontSize: 9 }}>Date: _______________</Text>
          </View>
          <View style={S.sigCol}>
            <Text style={{ fontFamily: 'Helvetica-Bold', marginBottom: 4 }}>Client</Text>
            <View style={S.sigLine} />
            {contract.signedByName && <Text>{contract.signedByName}</Text>}
            {signedDate ? (
              <Text style={{ color: '#6b7280', fontSize: 9 }}>Date: {signedDate}</Text>
            ) : (
              <Text style={{ color: '#6b7280', fontSize: 9 }}>Date: _______________</Text>
            )}
          </View>
        </View>
      </Page>
    </Document>
  )
}
