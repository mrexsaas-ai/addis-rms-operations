# ADDIS RMS Firestore Schema

## Design Rules

- Every document in every application collection includes a required `restaurantId`.
- `restaurantId` is the tenant ID and equals the document ID in `restaurants`.
- The Firebase Auth custom claim `restaurantId` is the authoritative tenant context. The `role` custom claim is one of `Admin`, `Manager`, `Waiter`, `Chef`, or `Barman`.
- Use server timestamps for `createdAt`, `updatedAt`, and event timestamps.
- Store money as integer minor units (`amountMinor`, such as cents) plus an ISO `currency` code. Never store floating-point currency values.
- Use document IDs as stable identifiers and references as strings unless a trusted server process requires a Firestore `DocumentReference`.

## Collection: `restaurants/{restaurantId}`

The SaaS tenant and its operating configuration. The document ID is the tenant's `restaurantId`.

| Field | Type | Required | Description |
|---|---|---:|---|
| `restaurantId` | string | yes | Must equal the document ID. |
| `name` | string | yes | Public restaurant name. |
| `legalName` | string | no | Registered business name. |
| `slug` | string | yes | Unique URL-safe identifier. |
| `status` | string | yes | `active`, `suspended`, or `trial`. |
| `timezone` | string | yes | IANA timezone, for example `Africa/Addis_Ababa`. |
| `defaultCurrency` | string | yes | ISO 4217 currency code. |
| `locale` | string | yes | Default locale, for example `en` or `am`. |
| `address` | map | no | `line1`, `line2`, `city`, `region`, `postalCode`, `country`. |
| `contact` | map | no | `email` and `phone`. |
| `settings` | map | no | Tax, receipt, order, and service preferences. |
| `createdAt` | timestamp | yes | Creation time. |
| `updatedAt` | timestamp | yes | Last modification time. |

## Collection: `users/{userId}`

Tenant membership profile linked to Firebase Authentication. Keep authorization claims synchronized with this document through a trusted Admin SDK process.

| Field | Type | Required | Description |
|---|---|---:|---|
| `restaurantId` | string | yes | Tenant membership. |
| `uid` | string | yes | Must equal the document ID and Auth UID. |
| `email` | string | yes | Auth email. |
| `displayName` | string | yes | Staff name. |
| `role` | string | yes | `Admin`, `Manager`, `Waiter`, `Chef`, or `Barman`. |
| `status` | string | yes | `active`, `invited`, or `disabled`. |
| `phone` | string | no | Contact number. |
| `avatarUrl` | string | no | Profile image URL. |
| `lastLoginAt` | timestamp | no | Last successful sign-in. |
| `createdAt` | timestamp | yes | Creation time. |
| `updatedAt` | timestamp | yes | Last modification time. |

## Collection: `menu_items/{itemId}`

Sellable menu items, optionally grouped by category.

| Field | Type | Required | Description |
|---|---|---:|---|
| `restaurantId` | string | yes | Tenant owner. |
| `name` | string | yes | Display name. |
| `description` | string | no | Customer-facing description. |
| `categoryId` | string | yes | Menu category identifier. |
| `priceMinor` | number | yes | Price in minor currency units. |
| `currency` | string | yes | ISO 4217 currency code. |
| `taxRate` | number | no | Decimal rate, such as `0.15`. |
| `sku` | string | no | Internal stock keeping unit. |
| `imageUrl` | string | no | Menu image URL. |
| `ingredients` | array | no | Ingredient or inventory item IDs. |
| `modifierGroups` | array | no | Modifier group IDs. |
| `available` | boolean | yes | Whether ordering is currently enabled. |
| `prepStation` | string | yes | `kitchen`, `bar`, or another configured station. |
| `createdAt` | timestamp | yes | Creation time. |
| `updatedAt` | timestamp | yes | Last modification time. |

## Collection: `orders/{orderId}`

Order header and lifecycle state. For high-volume systems, store line items in `orders/{orderId}/items/{itemId}`; each subcollection document must also carry `restaurantId` and have its own matching rules.

| Field | Type | Required | Description |
|---|---|---:|---|
| `restaurantId` | string | yes | Tenant owner. |
| `orderNumber` | string | yes | Human-readable number, unique per tenant/day. |
| `orderType` | string | yes | `dine_in`, `takeaway`, `delivery`, or `online`. |
| `tableId` | string | no | Dining table identifier. |
| `serverId` | string | yes | User ID responsible for the order. |
| `status` | string | yes | `open`, `submitted`, `preparing`, `ready`, `served`, `completed`, or `cancelled`. |
| `items` | array | yes | Snapshot lines: `menuItemId`, `name`, `quantity`, `unitPriceMinor`, `modifiers`, `notes`. |
| `subtotalMinor` | number | yes | Pre-tax amount. |
| `taxMinor` | number | yes | Tax amount. |
| `discountMinor` | number | yes | Discount amount. |
| `totalMinor` | number | yes | Final amount due. |
| `currency` | string | yes | ISO 4217 currency code. |
| `paymentStatus` | string | yes | `unpaid`, `partially_paid`, `paid`, or `refunded`. |
| `notes` | string | no | Service notes. |
| `createdAt` | timestamp | yes | Creation time. |
| `updatedAt` | timestamp | yes | Last modification time. |

## Collection: `inventory/{inventoryItemId}`

Current stock and reorder metadata. Inventory movements should be recorded by a trusted backend or an additional append-only subcollection.

| Field | Type | Required | Description |
|---|---|---:|---|
| `restaurantId` | string | yes | Tenant owner. |
| `name` | string | yes | Ingredient or supply name. |
| `sku` | string | no | Internal stock keeping unit. |
| `category` | string | yes | Inventory category. |
| `unit` | string | yes | `kg`, `liter`, `piece`, etc. |
| `quantityOnHand` | number | yes | Current quantity. |
| `reorderPoint` | number | yes | Threshold for replenishment. |
| `reorderQuantity` | number | yes | Suggested purchase quantity. |
| `costPerUnitMinor` | number | no | Latest unit cost in minor units. |
| `supplierId` | string | no | Supplier identifier. |
| `active` | boolean | yes | Whether the item is in use. |
| `lastCountedAt` | timestamp | no | Last stock count. |
| `createdAt` | timestamp | yes | Creation time. |
| `updatedAt` | timestamp | yes | Last modification time. |

## Collection: `payment_settings/{settingsId}`

Tenant-scoped payment provider configuration. Store provider secrets only in server-side secret storage, never in Firestore.

| Field | Type | Required | Description |
|---|---|---:|---|
| `restaurantId` | string | yes | Tenant owner. |
| `provider` | string | yes | `cash`, `stripe`, `telebirr`, or another supported provider. |
| `displayName` | string | yes | Staff-facing payment method name. |
| `enabled` | boolean | yes | Whether the method is available. |
| `currency` | string | yes | Supported ISO 4217 currency. |
| `publicConfig` | map | no | Non-secret provider settings. |
| `secretRef` | string | no | Reference to server-side secret storage. |
| `createdAt` | timestamp | yes | Creation time. |
| `updatedAt` | timestamp | yes | Last modification time. |

## Collection: `financial_logs/{logId}`

Append-oriented financial audit entries. Prefer creation by a trusted server process and treat entries as immutable after creation.

| Field | Type | Required | Description |
|---|---|---:|---|
| `restaurantId` | string | yes | Tenant owner. |
| `type` | string | yes | `sale`, `refund`, `expense`, `payout`, `adjustment`, or `tax`. |
| `orderId` | string | no | Related order. |
| `amountMinor` | number | yes | Signed amount in minor units. |
| `currency` | string | yes | ISO 4217 currency code. |
| `paymentMethod` | string | no | Payment method used. |
| `reference` | string | no | Provider or external reference. |
| `description` | string | yes | Human-readable audit description. |
| `createdBy` | string | yes | Auth UID or service identity. |
| `occurredAt` | timestamp | yes | Business event time. |
| `createdAt` | timestamp | yes | Audit record creation time. |
| `metadata` | map | no | Non-sensitive provider metadata. |

## Recommended Indexes

Create composite indexes only for queries that need them. Typical examples are:

- `orders`: `restaurantId ASC`, `status ASC`, `createdAt DESC`
- `orders`: `restaurantId ASC`, `serverId ASC`, `createdAt DESC`
- `menu_items`: `restaurantId ASC`, `categoryId ASC`, `available ASC`
- `inventory`: `restaurantId ASC`, `active ASC`, `quantityOnHand ASC`
- `financial_logs`: `restaurantId ASC`, `occurredAt DESC`
