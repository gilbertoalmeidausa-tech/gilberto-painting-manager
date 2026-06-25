import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  boolean,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// ─── Enums ────────────────────────────────────────────────────────────────────

export const planEnum = pgEnum('plan', ['free_trial', 'basic', 'pro', 'team'])
export const planStatusEnum = pgEnum('plan_status', ['trialing', 'active', 'past_due', 'canceled', 'paused'])
export const billingCycleEnum = pgEnum('billing_cycle', ['monthly', 'yearly'])
export const roleEnum = pgEnum('role', ['owner', 'admin', 'employee'])
export const projectStatusEnum = pgEnum('project_status', ['lead', 'active', 'on_hold', 'completed', 'cancelled'])
export const proposalStatusEnum = pgEnum('proposal_status', ['draft', 'sent', 'accepted', 'rejected', 'expired'])
export const contractStatusEnum = pgEnum('contract_status', ['draft', 'sent', 'signed', 'voided'])
export const invoiceStatusEnum = pgEnum('invoice_status', ['draft', 'sent', 'partial', 'paid', 'overdue', 'voided'])
export const photoPhaseEnum = pgEnum('photo_phase', ['before', 'during', 'after', 'completed'])

// ─── Organizations ────────────────────────────────────────────────────────────

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 150 }).notNull(),
  slug: varchar('slug', { length: 150 }).notNull().unique(),

  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
  stripeSubscriptionId: varchar('stripe_subscription_id', { length: 255 }),

  plan: planEnum('plan').notNull().default('free_trial'),
  planStatus: planStatusEnum('plan_status').notNull().default('trialing'),
  billingCycle: billingCycleEnum('billing_cycle').notNull().default('monthly'),

  trialEndsAt: timestamp('trial_ends_at'),
  currentPeriodEndsAt: timestamp('current_period_ends_at'),

  isActive: boolean('is_active').notNull().default(true),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const organizationSettings = pgTable('organization_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .unique()
    .references(() => organizations.id, { onDelete: 'cascade' }),

  companyName: varchar('company_name', { length: 150 }).notNull().default(''),
  phone: varchar('phone', { length: 30 }).notNull().default(''),
  email: varchar('email', { length: 255 }).notNull().default(''),
  website: varchar('website', { length: 255 }).notNull().default(''),
  address: varchar('address', { length: 255 }).notNull().default(''),
  city: varchar('city', { length: 100 }).notNull().default(''),
  state: varchar('state', { length: 100 }).notNull().default(''),
  zip: varchar('zip', { length: 20 }).notNull().default(''),
  logoPath: text('logo_path'),

  // Stored as cents (0 = 0%, 800 = 8.00%)
  defaultTaxRateCents: integer('default_tax_rate_cents').notNull().default(0),

  // JSON arrays stored as text
  defaultPaymentTerms: text('default_payment_terms').notNull().default(
    JSON.stringify([
      { label: 'Deposit', percent: 40, description: 'Due upon signing' },
      { label: 'Progress', percent: 30, description: 'Due at 50% completion' },
      { label: 'Final', percent: 30, description: 'Due upon completion' },
    ]),
  ),
  defaultTermsAndConditions: text('default_terms_and_conditions').notNull().default(''),

  invoicePrefix: varchar('invoice_prefix', { length: 10 }).notNull().default('INV'),
  proposalPrefix: varchar('proposal_prefix', { length: 10 }).notNull().default('P'),
  contractPrefix: varchar('contract_prefix', { length: 10 }).notNull().default('C'),

  nextInvoiceNumber: integer('next_invoice_number').notNull().default(1),
  nextProposalNumber: integer('next_proposal_number').notNull().default(1),
  nextContractNumber: integer('next_contract_number').notNull().default(1),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

// ─── Users ────────────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  avatarPath: text('avatar_path'),
  // Stored for refresh token rotation — one active refresh token per user
  refreshToken: text('refresh_token'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const organizationMembers = pgTable(
  'organization_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: roleEnum('role').notNull().default('employee'),
    isActive: boolean('is_active').notNull().default(true),
    invitedBy: uuid('invited_by').references(() => users.id, { onDelete: 'set null' }),
    joinedAt: timestamp('joined_at').notNull().defaultNow(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    uniqOrgUser: uniqueIndex('uq_org_member').on(t.organizationId, t.userId),
    orgIdx: index('org_members_org_idx').on(t.organizationId),
    userIdx: index('org_members_user_idx').on(t.userId),
  }),
)

// Pending invitations (before the invitee registers/accepts)
export const invitations = pgTable('invitations', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  email: varchar('email', { length: 255 }).notNull(),
  role: roleEnum('role').notNull().default('employee'),
  token: text('token').notNull().unique(),
  invitedBy: uuid('invited_by').references(() => users.id, { onDelete: 'set null' }),
  acceptedAt: timestamp('accepted_at'),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

// ─── Clients ──────────────────────────────────────────────────────────────────

export const clients = pgTable(
  'clients',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 150 }).notNull(),
    email: varchar('email', { length: 255 }),
    phone: varchar('phone', { length: 30 }),
    address: varchar('address', { length: 255 }),
    city: varchar('city', { length: 100 }),
    state: varchar('state', { length: 100 }),
    zip: varchar('zip', { length: 20 }),
    notes: text('notes'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    orgIdx: index('clients_org_idx').on(t.organizationId),
  }),
)

// ─── Projects ─────────────────────────────────────────────────────────────────

export const projects = pgTable(
  'projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id').references(() => clients.id, { onDelete: 'set null' }),
    name: varchar('name', { length: 200 }).notNull(),
    description: text('description'),
    status: projectStatusEnum('status').notNull().default('lead'),
    address: varchar('address', { length: 255 }),
    city: varchar('city', { length: 100 }),
    state: varchar('state', { length: 100 }),
    zip: varchar('zip', { length: 20 }),
    startDate: timestamp('start_date'),
    endDate: timestamp('end_date'),
    // Stored in cents
    totalValueCents: integer('total_value_cents'),
    notes: text('notes'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    orgIdx: index('projects_org_idx').on(t.organizationId),
    clientIdx: index('projects_client_idx').on(t.clientId),
    statusIdx: index('projects_status_idx').on(t.status),
  }),
)

// ─── Proposals ────────────────────────────────────────────────────────────────

export const proposals = pgTable(
  'proposals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
    proposalNumber: varchar('proposal_number', { length: 30 }).notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    status: proposalStatusEnum('status').notNull().default('draft'),

    // JSON: [{id, description, quantity, unit, unitPriceCents, totalCents}]
    lineItems: text('line_items').notNull().default('[]'),

    // All monetary values in cents
    subtotalCents: integer('subtotal_cents').notNull().default(0),
    taxRateCents: integer('tax_rate_cents').notNull().default(0),
    taxAmountCents: integer('tax_amount_cents').notNull().default(0),
    discountAmountCents: integer('discount_amount_cents').notNull().default(0),
    totalCents: integer('total_cents').notNull().default(0),

    // JSON: [{label, percent, amountCents, dueWhen}]
    paymentTerms: text('payment_terms').notNull().default('[]'),

    notes: text('notes'),
    validUntil: timestamp('valid_until'),

    sentAt: timestamp('sent_at'),
    acceptedAt: timestamp('accepted_at'),
    rejectedAt: timestamp('rejected_at'),

    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    orgIdx: index('proposals_org_idx').on(t.organizationId),
    projectIdx: index('proposals_project_idx').on(t.projectId),
    uniqOrgNumber: uniqueIndex('uq_proposal_number').on(t.organizationId, t.proposalNumber),
  }),
)

// ─── Contracts ────────────────────────────────────────────────────────────────

export const contracts = pgTable(
  'contracts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
    proposalId: uuid('proposal_id').references(() => proposals.id, { onDelete: 'set null' }),
    contractNumber: varchar('contract_number', { length: 30 }).notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    status: contractStatusEnum('status').notNull().default('draft'),

    scopeOfWork: text('scope_of_work').notNull().default(''),
    paymentTerms: text('payment_terms').notNull().default('[]'),
    termsAndConditions: text('terms_and_conditions').notNull().default(''),

    signedByName: varchar('signed_by_name', { length: 150 }),
    signedAt: timestamp('signed_at'),

    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    orgIdx: index('contracts_org_idx').on(t.organizationId),
    projectIdx: index('contracts_project_idx').on(t.projectId),
    uniqOrgNumber: uniqueIndex('uq_contract_number').on(t.organizationId, t.contractNumber),
  }),
)

// ─── Invoices ─────────────────────────────────────────────────────────────────

export const invoices = pgTable(
  'invoices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
    invoiceNumber: varchar('invoice_number', { length: 30 }).notNull(),
    status: invoiceStatusEnum('status').notNull().default('draft'),

    // JSON: [{id, description, quantity, unit, unitPriceCents, totalCents}]
    lineItems: text('line_items').notNull().default('[]'),

    subtotalCents: integer('subtotal_cents').notNull().default(0),
    taxRateCents: integer('tax_rate_cents').notNull().default(0),
    taxAmountCents: integer('tax_amount_cents').notNull().default(0),
    discountAmountCents: integer('discount_amount_cents').notNull().default(0),
    totalCents: integer('total_cents').notNull().default(0),
    amountPaidCents: integer('amount_paid_cents').notNull().default(0),
    amountDueCents: integer('amount_due_cents').notNull().default(0),

    dueDate: timestamp('due_date'),
    paidAt: timestamp('paid_at'),
    notes: text('notes'),

    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    orgIdx: index('invoices_org_idx').on(t.organizationId),
    projectIdx: index('invoices_project_idx').on(t.projectId),
    uniqOrgNumber: uniqueIndex('uq_invoice_number').on(t.organizationId, t.invoiceNumber),
  }),
)

// ─── Photos ───────────────────────────────────────────────────────────────────

export const photos = pgTable(
  'photos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
    // Relative path: "{orgId}/{projectId}/{uuid}.ext"
    filePath: text('file_path').notNull(),
    originalFilename: varchar('original_filename', { length: 255 }),
    mimeType: varchar('mime_type', { length: 50 }),
    fileSizeBytes: integer('file_size_bytes'),
    caption: text('caption'),
    phase: photoPhaseEnum('phase').notNull().default('before'),
    sortOrder: integer('sort_order').notNull().default(0),
    uploadedBy: uuid('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    orgIdx: index('photos_org_idx').on(t.organizationId),
    projectIdx: index('photos_project_idx').on(t.projectId),
  }),
)

// ─── Audit Logs ───────────────────────────────────────────────────────────────

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    action: varchar('action', { length: 100 }).notNull(),
    resourceType: varchar('resource_type', { length: 50 }).notNull(),
    resourceId: uuid('resource_id'),
    // JSON diff: {before: object|null, after: object|null}
    diff: text('diff'),
    ipAddress: varchar('ip_address', { length: 45 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    orgIdx: index('audit_logs_org_idx').on(t.organizationId),
    createdIdx: index('audit_logs_created_idx').on(t.createdAt),
    resourceIdx: index('audit_logs_resource_idx').on(t.resourceType, t.resourceId),
  }),
)

// ─── Relations ────────────────────────────────────────────────────────────────

export const organizationsRelations = relations(organizations, ({ one, many }) => ({
  settings: one(organizationSettings, {
    fields: [organizations.id],
    references: [organizationSettings.organizationId],
  }),
  members: many(organizationMembers),
  clients: many(clients),
  projects: many(projects),
  proposals: many(proposals),
  contracts: many(contracts),
  invoices: many(invoices),
  photos: many(photos),
  auditLogs: many(auditLogs),
  invitations: many(invitations),
}))

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(organizationMembers),
}))

export const organizationMembersRelations = relations(organizationMembers, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationMembers.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [organizationMembers.userId],
    references: [users.id],
  }),
}))

export const clientsRelations = relations(clients, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [clients.organizationId],
    references: [organizations.id],
  }),
  projects: many(projects),
}))

export const projectsRelations = relations(projects, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [projects.organizationId],
    references: [organizations.id],
  }),
  client: one(clients, {
    fields: [projects.clientId],
    references: [clients.id],
  }),
  proposals: many(proposals),
  contracts: many(contracts),
  invoices: many(invoices),
  photos: many(photos),
}))

export const proposalsRelations = relations(proposals, ({ one }) => ({
  organization: one(organizations, {
    fields: [proposals.organizationId],
    references: [organizations.id],
  }),
  project: one(projects, {
    fields: [proposals.projectId],
    references: [projects.id],
  }),
}))

export const contractsRelations = relations(contracts, ({ one }) => ({
  organization: one(organizations, {
    fields: [contracts.organizationId],
    references: [organizations.id],
  }),
  project: one(projects, {
    fields: [contracts.projectId],
    references: [projects.id],
  }),
  proposal: one(proposals, {
    fields: [contracts.proposalId],
    references: [proposals.id],
  }),
}))

export const invoicesRelations = relations(invoices, ({ one }) => ({
  organization: one(organizations, {
    fields: [invoices.organizationId],
    references: [organizations.id],
  }),
  project: one(projects, {
    fields: [invoices.projectId],
    references: [projects.id],
  }),
}))

export const photosRelations = relations(photos, ({ one }) => ({
  organization: one(organizations, {
    fields: [photos.organizationId],
    references: [organizations.id],
  }),
  project: one(projects, {
    fields: [photos.projectId],
    references: [projects.id],
  }),
}))

// ─── Inferred Types ───────────────────────────────────────────────────────────

export type Organization = typeof organizations.$inferSelect
export type NewOrganization = typeof organizations.$inferInsert
export type OrganizationSettings = typeof organizationSettings.$inferSelect
export type NewOrganizationSettings = typeof organizationSettings.$inferInsert

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type OrganizationMember = typeof organizationMembers.$inferSelect
export type NewOrganizationMember = typeof organizationMembers.$inferInsert
export type Invitation = typeof invitations.$inferSelect
export type NewInvitation = typeof invitations.$inferInsert

export type Client = typeof clients.$inferSelect
export type NewClient = typeof clients.$inferInsert
export type Project = typeof projects.$inferSelect
export type NewProject = typeof projects.$inferInsert
export type Proposal = typeof proposals.$inferSelect
export type NewProposal = typeof proposals.$inferInsert
export type Contract = typeof contracts.$inferSelect
export type NewContract = typeof contracts.$inferInsert
export type Invoice = typeof invoices.$inferSelect
export type NewInvoice = typeof invoices.$inferInsert
export type Photo = typeof photos.$inferSelect
export type NewPhoto = typeof photos.$inferInsert
export type AuditLog = typeof auditLogs.$inferSelect
export type NewAuditLog = typeof auditLogs.$inferInsert
