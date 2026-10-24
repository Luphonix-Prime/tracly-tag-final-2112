# TracelyTag --- QR Architecture, Database & Client Data Management

**Technical planning document \| Version 1.0 \| 23 October 2026**

## 1. Objective

TracelyTag must support two client/product paths:

1.  **GTIN available:** Product has a valid GTIN and uses an approved
    GS1 identification workflow.
2.  **GTIN unavailable, GSTIN available:** Business has a GSTIN but no
    GTIN for the product. Use a TracelyTag custom QR. GSTIN identifies
    the registered business for tax purposes; it is not a replacement
    for GTIN.

Both QR types can lead to the same TracelyTag consumer verification
page. The backend must identify the QR type and apply the correct
validation and resolution rules.

**Core recommendation:** Put a URL/identifier in the QR and keep
product, client, batch, dates, status and scan history in the database.
Do not embed all mutable business data in a custom QR.

## 2. Terminology

  -----------------------------------------------------------------------
  Term                    Meaning                 System treatment
  ----------------------- ----------------------- -----------------------
  GTIN                    GS1 Global Trade Item   Product identifier in
                          Number for a trade item the GS1 path

  GSTIN                   Indian GST registration Business/tax profile
                          identifier for a        only; never treat it as
                          business                GTIN

  Product ID              TracelyTag internal     Internal primary key
                          product record ID       

  QR token                Random, unguessable     Resolves a QR URL to a
                          identifier              server record

  Batch/lot               Production lot          Batch-level
                          identifier              traceability field

  Serial number           Identifier for an       Unit-level identifier
                          individual instance     when applicable

  GS1 Digital Link        Standard URI approach   Use when implementing
                          for expressing GS1      the GS1 Digital Link
                          identifiers on the web  path

  GS1 element string      GS1 Application         Encode using a suitable
                          Identifiers plus values GS1 carrier and its
                                                  rules
  -----------------------------------------------------------------------

GS1 Digital Link, GS1 element-string encoding and a TracelyTag custom QR
are not interchangeable. Do not claim GS1 compliance until the chosen
format, carrier and implementation have been validated.

## 3. QR architecture

### Type A --- GTIN available

If a web-enabled GS1 QR is desired, implement a properly formed **GS1
Digital Link URI** containing the GTIN and configure the resolver to
direct scans to the TracelyTag verification experience. Follow the
applicable GS1 Digital Link specification.

Illustrative shape only:

`https://id.example.com/01/08901234567896`

This is a placeholder, not a verified live resolver URL. Validate the
actual GTIN and confirm the client's rights/assignment where required.

If the client instead needs GS1 element strings, use a suitable carrier
and correct encoding. For example, AI (01) takes a 14-digit GTIN; AI
(11) and AI (17) dates use `YYMMDD`; AI (10) is variable length and
requires the correct separator when followed by another element string.
Parentheses in human-readable interpretation are not encoded as literal
parentheses in the raw element string.

**Backend rule:** GTIN identifies the trade item/product type. Batch,
expiry and serial describe the relevant batch/unit where used. Validate
mandatory associations and carrier-specific rules before calling a
payload GS1-compliant.

### Type B --- no GTIN, GSTIN available

Use a **TracelyTag custom QR** with a URL and random unique token:

`https://verify.example.com/p/7K9M2X8Q4V6N`

The domain and token are examples only. Generate a secure unique token
for each intended QR instance (or explicitly defined pack/batch level).
Keep GSTIN in the business profile. Do not place it in AI (01) or
present it as a GTIN.

### Why keep two explicit paths?

-   GSTIN identifies a registered business, not a particular product
    trade item or unit.
-   GTIN and GSTIN have different purposes and validation rules.
-   Explicit QR types simplify validation, analytics, audit and future
    changes.
-   Both types can still lead to the same consumer-facing verification
    page.

## 4. Recommended database model

Use PostgreSQL or the database already approved by the current
TracelyTag architecture. The schema below is a logical design; confirm
it against the existing codebase before migrations.

### 4.1 `clients` --- business/client profile

One record per client/company.

  ----------------------------------------------------------------------------------------
  Field                         Suggested type                Required Notes
  ----------------------------- ---------------- --------------------- -------------------
  `id`                          UUID                               Yes Primary key

  `legal_name`                  Text                               Yes Registered/legal
                                                                       name

  `display_name`                Text                                No Brand/display name

  `gstin`                       Text                       Conditional Normalize and store
                                                                       as text

  `gstin_verification_status`   Text/enum                          Yes `UNVERIFIED`,
                                                                       `VERIFIED`,
                                                                       `REJECTED`,
                                                                       `NOT_PROVIDED`

  `gstin_verified_at`           Timestamp                           No Set only after
                                                                       verification

  `gstin_verification_source`   Text                                No Actual verification
                                                                       source

  `contact_email`               Text                                No Access-controlled

  `contact_phone`               Text                                No Access-controlled

  `address`                     Structured                          No Collect only if
                                fields/JSON                            needed

  `status`                      Text/enum                          Yes `ACTIVE`,
                                                                       `SUSPENDED`,
                                                                       `CLOSED`

  `created_at`, `updated_at`    Timestamp                          Yes Audit timestamps
  ----------------------------------------------------------------------------------------

GSTIN format validation is not the same as confirming registration
status. Mark it verified only after an approved source/provider confirms
it.

### 4.2 `products` --- product master

One record per client product/variant.

  --------------------------------------------------------------------------------------
  Field                      Suggested type                Required Notes
  -------------------------- ---------------- --------------------- --------------------
  `id`                       UUID                               Yes TracelyTag product
                                                                    ID

  `client_id`                UUID                               Yes FK to `clients.id`

  `product_name`             Text                               Yes Product name

  `brand_name`               Text                                No Brand

  `internal_sku`             Text                                No Client's SKU

  `qr_type`                  Text/enum                          Yes Product default
                                                                    only; per-QR type
                                                                    also stored in
                                                                    `qr_codes`

  `gtin`                     Text                       Conditional Required for
                                                                    GTIN-based GS1 path;
                                                                    store as text to
                                                                    preserve leading
                                                                    zeros

  `gtin_type`                Text                                No GTIN-8/12/13/14 if
                                                                    useful

  `gtin_validation_status`   Text                                No Distinguish
                                                                    format/check-digit
                                                                    validation from
                                                                    assignment
                                                                    verification

  `category`                 Text                                No Product category

  `unit_of_measure`          Text                                No If required

  `description`              Text                                No Product details

  `status`                   Text/enum                          Yes `DRAFT`, `ACTIVE`,
                                                                    `ARCHIVED`,
                                                                    `BLOCKED`

  `created_at`, `updated_at` Timestamp                          Yes Audit timestamps
  --------------------------------------------------------------------------------------

Constraints: - `products.id` is the primary key; `client_id` references
`clients.id`. - Store GTIN as text, never as an integer. - Define GTIN
uniqueness/ownership carefully for a multi-client platform; do not
impose global uniqueness without checking the business model. - One
product can have many batches and many QR codes.

### 4.3 `batches` --- batch/lot and dates

One record per production batch when batch tracking applies.

  ---------------------------------------------------------------------------------
  Field                  Suggested type                Required Notes
  ---------------------- ---------------- --------------------- -------------------
  `id`                   UUID                               Yes Primary key

  `product_id`           UUID                               Yes FK to product

  `batch_number`         Text                       Conditional Required when lot
                                                                tracking applies

  `manufacturing_date`   Date                       Conditional Business/category
                                                                requirements decide

  `expiry_date`          Date                       Conditional Required when
                                                                applicable

  `best_before_date`     Date                       Conditional Keep separate from
                                                                expiry where
                                                                relevant

  `quantity_produced`    Numeric                             No Optional

  `status`               Text                               Yes `ACTIVE`,
                                                                `RECALLED`,
                                                                `CLOSED`, `BLOCKED`

  `created_at`,          Timestamp                          Yes Audit timestamps
  `updated_at`                                                  
  ---------------------------------------------------------------------------------

Suggested index: `(product_id, batch_number)`. Decide whether batch
numbers are unique per product, client or another defined scope.

### 4.4 `qr_codes` --- every issued QR

One row per QR token/label. For unit-level authentication, issue a
unique token per unit. If the same QR is shared by a carton or batch,
model that level explicitly; do not claim it authenticates one unique
unit.

  ------------------------------------------------------------------------------------
  Field                 Suggested type                Required Notes
  --------------------- ---------------- --------------------- -----------------------
  `id`                  UUID                               Yes Internal QR record ID

  `client_id`           UUID                               Yes Tenant boundary

  `product_id`          UUID                               Yes FK to product

  `batch_id`            UUID                                No FK to batch

  `qr_type`             Text/enum                          Yes `GS1_DIGITAL_LINK`,
                                                               `GS1_ELEMENT_STRING`,
                                                               `CUSTOM_URL`

  `qr_token_hash`       Text                   Recommended for Store a hash if token
                                                 custom tokens lookup is designed
                                                               around it

  `public_token`        Text                       Alternative If stored directly, use
                                                               an unguessable token
                                                               and restrict access

  `serial_number`       Text                       Conditional Unit serial where
                                                               applicable

  `payload_version`     Integer/Text                       Yes Enables format
                                                               evolution

  `status`              Text/enum                          Yes `GENERATED`, `ACTIVE`,
                                                               `BLOCKED`, `REVOKED`,
                                                               `DESTROYED`

  `generated_at`        Timestamp                          Yes Generation timestamp

  `activated_at`        Timestamp                           No Activation timestamp

  `first_scanned_at`,   Timestamp                           No Scan summary
  `last_scanned_at`                                            

  `scan_count`          Integer                            Yes Initialize to zero;
                                                               detailed history
                                                               belongs in events

  `label_batch_id`      UUID/Text                           No Printing run reference

  `created_by`          UUID                                No User who generated it
  ------------------------------------------------------------------------------------

Recommended constraints: - Unique token/hash. - Foreign keys to client,
product and optional batch. - Ensure the QR's client matches the
product's owner. - If serials must be unique, define the scope (per
product, batch, client or unit) and enforce it. - Blocked/revoked codes
must never return a positive active result.

### 4.5 `scan_events` --- scan/verification history

Keep an append-only event table instead of relying only on `scan_count`.

  -------------------------------------------------------------------------------------
  Field                  Suggested type                Required Notes
  ---------------------- ---------------- --------------------- -----------------------
  `id`                   UUID                               Yes Event ID

  `qr_code_id`           UUID                               Yes QR record

  `scanned_at`           Timestamp                          Yes Server timestamp

  `result`               Text                               Yes e.g. `RECORD_FOUND`,
                                                                `REPEAT_SCAN_REVIEW`,
                                                                `BLOCKED`, `UNKNOWN`,
                                                                `EXPIRED`, `SUSPICIOUS`

  `source`               Text                                No Consumer web, app,
                                                                admin

  `ip_risk_hash`         Text                          Optional Privacy-preserving risk
                                                                signal if needed

  `user_agent_summary`   Text                          Optional Minimize collection

  `country_or_region`    Text                          Optional Only if needed and
                                                                lawfully derived

  `request_id`           Text                                No Debug/audit correlation

  `created_at`           Timestamp                          Yes Event timestamp
  -------------------------------------------------------------------------------------

Use rate limits and retention policies. A repeat scan alone does not
prove counterfeit; staff, consumers, retries or a shared photo can cause
repeat scans.

### 4.6 `audit_logs` --- administrative actions

Log sensitive actions: product edits, GTIN/GSTIN changes, batch updates,
QR blocking, role changes and bulk exports. Include actor, action,
target, timestamp and appropriate before/after values. Restrict edits to
audit records.

### 4.7 `users` and `client_memberships` --- permissions

For a multi-client SaaS, users must be scoped to their client(s).
Suggested roles: `PLATFORM_ADMIN`, `CLIENT_ADMIN`,
`PRODUCTION_OPERATOR`, `VIEWER`. Enforce authorization on the server for
every request; hiding a UI control is not security.

## 5. Relationships

``` text
clients
  ├── products
  │     ├── batches
  │     │     └── qr_codes
  │     └── qr_codes
  ├── client_memberships / users
  └── audit_logs

qr_codes
  └── scan_events
```

Keep these identifiers separate: - **GTIN:** trade item/product type
identifier. - **Serial number:** individual item identifier where used
with the applicable trade-item identifier. - **QR token:** TracelyTag
lookup/authentication token. - **GSTIN:** business tax registration
identifier.

## 6. What goes inside the QR and what stays in the database?

  -----------------------------------------------------------------------
  Data                    In QR?                  In database?
  ----------------------- ----------------------- -----------------------
  Custom TracelyTag URL   Yes                     URL configuration and
                                                  QR type

  Random token            Yes, in URL             Token or token hash

  GTIN                    In GS1 Digital          Yes, product master
                          Link/element-string     
                          workflow as specified   

  GSTIN                   Normally no; never as   Yes, client/business
                          AI (01)                 profile

  Product name/details    Usually unnecessary in  Yes
                          custom QR               

  Batch/lot               Only when appropriate   Yes
                          for chosen GS1          
                          workflow; otherwise     
                          resolve server-side     

  Manufacturing/expiry    Only when applicable    Yes
  dates                   and allowed by chosen   
                          GS1 format/carrier      

  Serial number           In applicable GS1       Yes
                          serialization workflow; 
                          custom QR can resolve   
                          through token           

  Status, scan history,   No                      Yes
  risk signals                                    

  Private                 No                      Yes, access-controlled
  contact/business                                
  details                                         
  -----------------------------------------------------------------------

Custom QR example:

`https://verify.example.com/p/<random-token>`

For GTIN products, choose and document either a properly implemented GS1
Digital Link URI, a GS1 element string in a suitable carrier, or both.
Do not treat those payloads as identical.

## 7. Scan-to-verification flow

1.  Consumer scans QR.
2.  Web app receives the URL/identifier.
3.  Backend validates and normalizes it; never trust product details
    submitted by a browser.
4.  Route according to `qr_type`:
    -   `CUSTOM_URL`: resolve random token.
    -   `GS1_DIGITAL_LINK`: parse the URI and resolve GTIN/other
        supported keys.
    -   `GS1_ELEMENT_STRING`: parse AI data from a compatible
        reader/scanner format; phone cameras do not all return identical
        raw data.
5.  Fetch linked product, batch and unit records.
6.  Check QR, product and batch status; apply expiry/recall rules where
    relevant.
7.  Record scan event and run rate/risk checks.
8.  Show a safe result:
    -   Record found and checks passed.
    -   Repeat scan needs review.
    -   Expired, blocked or recalled where applicable.
    -   Unknown/invalid token.
9.  Never expose another client's private data.

A database lookup proves that a code maps to a record; a QR alone does
not prove the physical item is genuine because a QR image can be copied.
Stronger controls can include tamper-evident labels, controlled
issuance/printing and risk-based scan analysis.

## 8. QR generation and production workflow

1.  Create client/business profile.
2.  Create product master.
3.  Select path: valid GTIN → approved GS1 workflow; no GTIN → custom
    URL QR.
4.  Add batch and applicable dates.
5.  Define label level: individual unit, pack, carton or batch.
6.  Generate a unique, cryptographically random token for each intended
    QR instance.
7.  Save QR record and payload version.
8.  Generate artwork using a tested encoder; apply GS1 rules only to the
    GS1 path.
9.  Run payload validation and printed-label scan QA.
10. Activate codes at the approved production/packing stage.
11. Reconcile generated, printed, rejected, wasted and activated labels.
12. Maintain block/revoke and audit workflows.

Never use sequential IDs, GSTIN, phone numbers or predictable SKU/batch
combinations as public tokens.

## 9. Validation rules

### GTIN

-   Store as text to preserve leading zeros.
-   Validate supported length and check digit.
-   A valid check digit does not by itself prove official assignment to
    the client/product.
-   Never put GSTIN into AI (01).

### Dates

-   Store in database date fields, e.g. `2026-04-01`.
-   GS1 AI date fields use `YYMMDD`, e.g. 1 April 2026 → `260401`.
-   Validate calendar dates and category/business rules.
-   Do not invent missing date components; follow applicable GS1 rules.

### Batch and serial

-   Batch number is not automatically a unique unit identifier.
-   Define uniqueness scope explicitly.
-   Validate serial uniqueness if required by the business workflow.
-   Follow mandatory GS1 associations when using GS1 serial/batch/date
    AIs.

### GSTIN

-   Format validation and registration-status verification are
    different.
-   Only mark registration verified when a real approved verification
    source confirms it.
-   Keep GSTIN separate from GTIN and QR token.

### QR token

-   Must be unique and unpredictable.
-   Use HTTPS, rate limiting and protection against
    enumeration/scraping.
-   Do not expose database primary keys or private client data in public
    URLs.

## 10. Illustrative API outline

These are proposed endpoints, not a final API contract; align them with
the existing backend.

  ------------------------------------------------------------------------------------
  Endpoint                             Purpose                 Access
  ------------------------------------ ----------------------- -----------------------
  `POST /api/clients`                  Create client           Platform
                                                               admin/authorized
                                                               onboarding

  `POST /api/products`                 Create product master   Authorized client user

  `POST /api/products/{id}/batches`    Create batch/dates      Authorized client user

  `POST /api/qr-codes/bulk-generate`   Generate QR records     Authorized production
                                                               role

  `POST /api/qr-codes/{id}/activate`   Activate labels         Authorized production
                                                               role

  `POST /api/qr-codes/{id}/block`      Block/revoke code       Authorized role; audit
                                                               required

  `GET /p/{token}`                     Public verification     Public, rate-limited

  `GET /api/products/{id}`             Product management data Authenticated and
                                                               tenant-authorized

  `GET /api/scan-events`               Scan history            Authorized users only
  ------------------------------------------------------------------------------------

Finalize authentication, authorization, request/response schemas,
idempotency, pagination and errors before implementation. Public
endpoints must return only approved public fields.

## 11. Security and multi-client isolation

-   Enforce tenant isolation in every API and database query.
-   Use role-based access control and least privilege.
-   Use HTTPS and protect secrets/credentials.
-   Keep GSTIN and contact details out of public QR URLs and public
    responses unless explicitly required and approved.
-   Validate all inputs server-side; use parameterized database queries
    and safe output encoding.
-   Rate-limit scans, token lookups and bulk generation.
-   Protect audit logs and define scan-data retention/deletion rules.
-   Collect only data needed for the product.
-   Back up the database and test restores.
-   Use migrations and backups before schema changes.
-   Require authorization and audit logging for changes to GTIN,
    ownership, status and verification data.

## 12. Status and verification logic

Keep product, batch and QR statuses separate.

-   Product: `DRAFT`, `ACTIVE`, `ARCHIVED`, `BLOCKED`
-   Batch: `ACTIVE`, `RECALLED`, `CLOSED`, `BLOCKED`
-   QR: `GENERATED`, `ACTIVE`, `BLOCKED`, `REVOKED`, `DESTROYED`

A blocked/revoked QR or a QR linked to a blocked/recalled product/batch
must not show a positive result. Apply expiry logic only where a valid
applicable expiry date exists. Define permitted status transitions and
authorized roles.

Suggested public outcomes: `RECORD_FOUND`, `REPEAT_SCAN_REVIEW`,
`EXPIRED`, `BLOCKED_OR_RECALLED`, `CODE_NOT_FOUND`, `TEMPORARY_ERROR`.

Do not promise "100% genuine" merely because a token exists.

## 13. Implementation phases

### Phase 1 --- Core platform

-   Client/business profiles
-   Product master
-   Custom token generation and resolution
-   Public verification page
-   Authentication and tenant isolation
-   Scan events
-   Block/revoke controls

### Phase 2 --- GS1 support

-   GTIN validation and assignment-status tracking
-   Decide whether to support GS1 Digital Link, GS1 element strings or
    both
-   Correct URI/AI encoding and carrier-specific validation
-   Reader/scanner integration tests
-   Label QA

### Phase 3 --- Batch and production controls

-   Batch/lot, manufacturing and expiry dates
-   Bulk QR generation and print reconciliation
-   Unit-level serialization where required
-   Recall/block workflow and audit logs

### Phase 4 --- Analytics and stronger anti-counterfeit controls

-   Repeat-scan/risk rules
-   Client dashboards and exports
-   Suspicious-pattern review
-   Tamper-evident packaging/label process integration where appropriate

Do not scale machine/label production until software, payloads, printed
labels, scanners, revocation and tenant security have been tested.

## 14. Release test checklist

-   [ ] GSTIN-only client can create a product without GTIN and issue a
    custom QR.
-   [ ] GTIN client uses only the selected, validated GS1 workflow.
-   [ ] GSTIN is never encoded as AI (01).
-   [ ] GTIN leading zeros are preserved.
-   [ ] Invalid GTIN length/check digit is rejected or marked invalid.
-   [ ] GS1 dates encode/decode correctly.
-   [ ] AI (10) separator is correct when followed by another AI in a
    variable-length element string.
-   [ ] QR token is unique and unpredictable.
-   [ ] Unknown token returns a safe error.
-   [ ] Blocked/revoked code never returns positive verification.
-   [ ] Expiry and recall behavior matches configured rules.
-   [ ] One client cannot view/edit another client's data.
-   [ ] Repeat scans are logged without automatically declaring
    counterfeit.
-   [ ] Printed QR scans on intended phones and industrial scanners.
-   [ ] Printed/rejected/wasted/activated label counts reconcile.
-   [ ] Backup restore, audit logs and rate limits are tested.

## 15. Decisions required before coding

1.  **QR level:** Is every QR unique per unit, pack, carton or batch?
2.  **GS1 route:** Do GTIN clients need GS1 Digital Link QR, GS1
    DataMatrix/element strings, or both?
3.  **Ownership:** Can one client have multiple GSTINs? Can a
    GTIN/product be shared across client accounts?
4.  **Required fields:** Which categories require batch, manufacturing
    date, expiry/best-before and serial?
5.  **Consumer behavior:** What should first scan, repeat scan, expiry,
    recall and blocked-code pages say?
6.  **Verification sources:** How will GTIN assignment and GSTIN
    registration be verified, if required?
7.  **Existing architecture:** Which database, backend framework, auth
    system and deployment setup does TracelyTag already use?

Do not guess these decisions in production code. Confirm them and align
schema/API with the current codebase.

## 16. Standards and assumptions

-   The uploaded `GST.pdf` is identified as the GS1 General
    Specifications Standard, Release 26.0 (January 2026). Pages 296--297
    describe mandatory associations for AI (10) batch/lot, date AIs
    including (11) and (17), and AI (21) serial number with qualifying
    GS1 identifiers. Validate final payloads against the applicable
    standard and chosen carrier.
-   This is an application/database architecture recommendation, not
    certification that a particular QR, label or product is
    GS1-compliant.
-   Example domains and tokens are placeholders.
-   Final schema and APIs must be checked against the current codebase
    before implementation or database migration.

## Final recommendation

Build **one TracelyTag verification platform with two explicit
identification paths**:

-   **GTIN product:** approved GS1 workflow + TracelyTag
    resolver/verification integration.
-   **GSTIN-only/no-GTIN product:** custom URL QR + random unique token.

Keep client/business data, product master, batches, QR records, scan
events and audit logs separate. This supports multiple clients without
confusing GSTIN with GTIN or claiming GS1 compliance for a custom QR.
