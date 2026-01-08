You are a senior full-stack engineer and product-minded UI designer. Build a complete, beautiful, maintainable finance management web app for a small wholesale shop. The system manages purchase/sales orders, contacts, products, cash transactions, and a manual verification workflow for AI-scanned receipts.

IMPORTANT: You must output a COMPLETE PROJECT (all files) that can be installed and run locally. Do not provide partial snippets. Provide the full directory tree and the full contents of every file you create.

Tech stack (MANDATORY):
- Frontend: Next.js 14+ (App Router), React, TypeScript
- Styling: TailwindCSS + shadcn/ui (use consistent design system)
- Data fetching: TanStack Query (react-query)
- Forms: React Hook Form + Zod (schema-driven validation)
- State: Prefer TanStack Query + URL state; use Zustand only if necessary
- Build tooling: pnpm (preferred) or npm (acceptable). Include lockfile guidance in README.
- No backend implementation. Treat backend as an external REST API. You must implement a typed API client wrapper.

Global hard rules (MUST FOLLOW):
1) NEVER render any internal database IDs in the UI. This includes (but not limited to): id, order_id, contact_id, product_id, item_id, image_id, scan_job_id, version, etc. These may exist in JSON payloads and routes, but MUST NOT appear as visible text anywhere in the UI (tables, forms, labels, debug panels, error messages, toasts).
2) All backend objects follow a "key + display" contract:
   - "key": internal keys (ids) used only for actions (navigate, save, delete).
   - "display": business-readable fields shown in the UI.
   The UI MUST render only display.* fields.
3) Implement fuzzy matching dropdowns (autocomplete) for selecting Contacts and Products:
   - On app start, preload lookups: contacts and products (few thousand items).
   - When user types a query q (example: "酱"), show dropdown options where display.name includes q.
   - Sorting: options where name startsWith(q) come first; then other includes; then shorter names first.
   - Debounce: 200ms.
   - Limit: show at most 20 options.
   - When user selects an option, bind the internal key (contact_id / product_id) but show only display fields.
   - If user types but DOES NOT select from dropdown, keep the bound id as null and store raw text (e.g., product_name_raw). This is required for verification logic and for correct saving.
4) Manual verification workflow is the main operational flow:
   - A "Manual Verification Queue" page shows all orders with manual_verified=false.
   - Provide Tabs:
     a) Quick Verify: auto_verified=true
     b) Needs Work: auto_verified=false (show issue tags)
     c) All Unverified
   - Each row shows only business-readable fields (order_no, contact_name, date, totals, badges, issue tags, image count/thumbnail).
   - Clicking a row opens Order Detail page.
5) Order Detail editor page:
   - Layout: Desktop uses split view (left: receipt image viewer; right: editable order form and items). Mobile uses stacked layout (images on top, form below).
   - Receipt image viewer:
     - Supports multiple images per order
     - Shows thumbnails
     - Main image supports zoom in/out, rotate, fit-to-width
     - If any text overlay is used on image, it MUST be English only (avoid Chinese glyph issues)
   - Editable header fields: contact selector (autocomplete), order_date, order_no (read-only by default), remark (optional)
   - Items table:
     - Each row: Product selector (autocomplete), unit, unit_price, quantity, line_total (computed display)
     - Row has a Delete button at the end
     - Below the last row there is an "Add Item" button
     - Editing unit_price or quantity updates line_total and order_total immediately in UI
   - Sticky bottom action bar:
     - Back
     - Save (updates order but does not set manual_verified)
     - Verify (sets manual_verified=true)
   - After Save or Verify, navigate back to the Manual Verification Queue page, preserving the previous tab and filters.
6) Design requirements (aesthetic + usability):
   - Use shadcn/ui components consistently: Card, Table/DataTable, Badge, Tabs, Dialog, Button, Input, Popover, Dropdown.
   - Visual hierarchy: clear headings, subdued secondary text, clean spacing.
   - Responsive: good on desktop and mobile. Mobile must be "single-hand friendly".
   - Status badges:
     - manual_verified: show "Unverified"/"Verified"
     - auto_verified: show "Auto Pass"/"Auto Flag"
     - settled: show "Settled"/"Unsettled"
   - Issue tags: small badges with codes (CONTACT_NOT_FOUND, PRODUCT_NOT_FOUND, TOTAL_MISMATCH, DATE_PARSE_FAIL, etc).
   - DO NOT show IDs even in tooltips, aria-labels, toasts, error messages.
7) Maintainability requirements (to make AI modifications easy):
   - Strict folder structure; pages only compose feature components; business logic in features.
   - Centralize types and schemas; avoid duplicated field definitions.
   - All API endpoints in one typed client module.
   - Use optimistic locking field "version" in requests but do not display it.
   - Use query keys constants and typed hooks.

Project structure (MANDATORY):
- src/app/
  - layout.tsx
  - page.tsx (redirect to /verify)
  - verify/page.tsx
  - orders/[type]/[orderId]/page.tsx
  - contacts/page.tsx
  - products/page.tsx
  - cash/page.tsx
  - dashboard/page.tsx (optional but recommended)
- src/features/
  - verify/
    - components/QueueTabs.tsx
    - components/VerificationQueueTable.tsx
    - components/IssueBadges.tsx
    - api.ts
    - types.ts
  - orders/
    - components/OrderEditor.tsx
    - components/OrderHeaderForm.tsx
    - components/OrderItemsTable.tsx
    - components/OrderImagePanel.tsx
    - components/VerifyActionBar.tsx
    - api.ts
    - types.ts
    - schemas.ts
  - lookups/
    - useLookups.ts
    - localSearch.ts
    - types.ts
- src/components/
  - nav/SideNav.tsx
  - nav/TopBar.tsx
  - common/LoadingState.tsx
  - common/EmptyState.tsx
- src/components/ui/ (shadcn/ui generated components)
- src/lib/
  - apiClient.ts
  - queryKeys.ts
  - format.ts
  - routeState.ts (helpers to preserve tab/filter state)
- tailwind.config.ts, postcss.config.js, next.config.js/ts, tsconfig.json
- README.md with setup and env vars

Routing and navigation:
- /verify is the operational home.
- /orders/sales/[orderId] and /orders/purchase/[orderId] are detail pages.
- Use the route param [type] = "sales" | "purchase". Validate it and show a user-friendly error WITHOUT exposing IDs.
- Preserve verify list state (tab, search q, date filters) when going to detail and back:
  - Use URL query params on /verify: tab, q, date_from, date_to
  - When navigating back, restore these params.

Backend API contract (MANDATORY; implement client + hooks accordingly):
Base URL: environment variable NEXT_PUBLIC_API_BASE_URL

Lookups:
1) GET /lookups/version
   Response: { "version": "ISO8601 string" }

2) GET /lookups/products
   Response: { "version": "ISO8601 string", "items": LookupEntry[] }

3) GET /lookups/contacts
   Response: { "version": "ISO8601 string", "items": LookupEntry[] }

Optional search fallback:
4) GET /search/products?q=...&limit=20
5) GET /search/contacts?q=...&limit=20

Orders:
6) GET /orders/{type}
   Query params:
     - manual_verified (true/false)
     - auto_verified (true/false)
     - settled (true/false)
     - q (search by order_no or contact_name)
     - date_from (YYYY-MM-DD)
     - date_to (YYYY-MM-DD)
     - page (number)
     - page_size (number)
   Response:
   {
     "page": 1,
     "page_size": 20,
     "total": 123,
     "items": OrderSummary[]
   }

7) GET /orders/{type}/{order_id}
   Response: OrderDetail
   Note: include key.version for optimistic locking

8) PUT /orders/{type}/{order_id}
   Request: UpdateOrderRequest
   - Must include version (optimistic locking)
   - Must include editable header fields and full items array.
   Response: OrderDetail

9) POST /orders/{type}/{order_id}/verify
   Request: { "version": number }
   Response: OrderDetail

Types (use TypeScript types; DO NOT display internal ids):
- LookupEntry:
  {
    "key": { "product_id"?: number, "contact_id"?: number },
    "display": { "name": string, "spec"?: string, "default_unit"?: string, "phone"?: string }
  }

- OrderSummary:
  {
    "key": { "order_id": number, "order_type": "sales"|"purchase" },
    "display": {
      "order_no": string,
      "contact_name": string,
      "order_date": "YYYY-MM-DD",
      "total_amount": number,
      "manual_verified": boolean,
      "auto_verified": boolean,
      "settled": boolean,
      "issue_tags": string[],
      "image_count": number
    }
  }

- OrderDetail:
  {
    "key": { "order_id": number, "order_type": "sales"|"purchase", "version": number },
    "display": {
      "order_no": string,
      "contact": LookupEntry | null,
      "order_date": "YYYY-MM-DD",
      "manual_verified": boolean,
      "auto_verified": boolean,
      "settled": boolean,
      "total_amount": number,
      "remark"?: string,
      "issues": { "code": string, "detail"?: string }[],
      "images": { "key": { "image_id": number }, "display": { "mime_type": string, "base64": string } }[],
      "items": OrderItem[]
    }
  }

- OrderItem:
  {
    "key": { "item_id": number, "product_id"?: number | null },
    "display": {
      "product_name"?: string | null,
      "product_name_raw"?: string | null,
      "unit": string,
      "unit_price": number,
      "quantity": number,
      "line_total": number
    }
  }

UpdateOrderRequest rules:
- It must carry:
  - version (from OrderDetail.key.version)
  - contact: either selected lookup key (contact_id) OR null + raw name (if you decide to support raw contact text; otherwise require selection)
  - order_date
  - remark (optional)
  - items array:
     - Each item includes key.item_id
     - Product: if selected, include key.product_id; if not selected, set product_id=null and include product_name_raw
     - unit, unit_price, quantity
- UI must compute line_total and total_amount for display, but backend remains source of truth.

Error handling:
- Show clean user-friendly messages (Chinese OK) WITHOUT exposing IDs.
- If optimistic lock fails, show a dialog: "数据已更新，请刷新后重试" (or equivalent) without any ids.

Implementation details (MANDATORY):
- Add a shared layout with SideNav (desktop) and TopBar (mobile).
- Add loading and empty states.
- Use a consistent DatePicker (shadcn/ui).
- Use a Table component for list and items. You may implement a simple table rather than a full data grid.
- Use Badges for statuses and issue tags.
- Use React Query to cache:
  - lookups
  - order lists
  - order details
- Prefetch order detail on row hover (optional).
- Autocomplete component:
  - Use Popover + Command (shadcn pattern) or Combobox pattern.
  - Must support keyboard navigation and mobile touch.
  - Must hide IDs.

Deliverables (MANDATORY):
1) Full project folder tree.
2) Full content of all files.
3) README.md with:
   - install commands
   - env var setup
   - run dev server
   - build and start
4) Ensure the app compiles with TypeScript and runs.

Now generate the entire project.

