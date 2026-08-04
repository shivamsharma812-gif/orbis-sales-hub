# Structured "Mark lost" reasons, mandate services on conversion, and PCM

## 1. Mark lost — pick a reason

Clicking "Mark lost" on a lead opens a popup with a required single-choice list:

- Requires bank custodian
- Lack of follow ups
- Inadequate Commercial quotations
- Other — reveals a text box where the reason is typed manually

The saved lost reason stays a single text value, so lost-lead cards, the lost list, and reporting keep working unchanged. Picking "Other" saves the typed text; the other options save their label. The "Mark lost" button stays disabled until a choice (and, for Other, some text) is provided.

## 2. Convert to client — choose mandate services

"Convert to client" no longer converts immediately. It opens a popup listing all services as checkboxes, pre-ticked with the services already marked as interested on the lead:

- Custody & Allied Services
- PCM
- RTA
- Trusteeship
- Fund Accounting
- Fund Administration

At least one must be ticked. Only the ticked services become the new client's services, so the client list and client record show exactly what the mandate was signed for. The lead's own "services interested in" stays as it was.

## 3. Add PCM everywhere

PCM is added as a selectable service in:

- Create Lead wizard (Services step)
- Lead workspace "Services interested in" chips
- The new convert-to-client mandate popup
- Clients list service filter and the add-client form service dropdown
- The Services tab copy on the client record

## Technical notes

- `src/routes/_authenticated/leads.$id.tsx`: replace the free-text lost dialog with a radio group + conditional textarea; add a convert dialog holding a checkbox state seeded from `lead.services`, and pass the selected list into the existing `convert` mutation (which joins them into `clients.service_type`).
- Extend `SERVICE_OPTIONS` in `leads.$id.tsx` and `SERVICES` in `src/components/create-lead-wizard.tsx` with `"PCM"`; add PCM to the hardcoded service arrays in `src/routes/_authenticated/clients.index.tsx` and the copy in `clients.$id.tsx`.
- No database changes: `lost_reason` remains text, `clients.service_type` remains a joined string.
