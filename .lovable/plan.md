## Problem

You're right. On the **Vertex Capital** lead (owned by Anita Chouhan, who sits under Murlidhar → Rishav), one of the tasks — *"Send NDA for signature"* — is assigned to **Shruti Dwivedi**, who reports up through a completely different sub-tree (Sharath → Vinay). That assignee has no hierarchical relationship to the record's owner, so it violates the "own + team" model.

This isn't a one-off. A scan of the seeded `tasks` table shows the assignment logic was effectively random across the org — I found dozens of tasks where the assignee sits outside the owner's sub-tree (e.g. "Reconcile client AUC data" owned by Shivam Sharma but assigned to Anita Chouhan, who is not on Shivam's team).

Only `tasks` has an `assigned_to` field. `meetings`, `followups`, `notes`, etc. are scoped purely by `owner_id`, so they're unaffected.

## Rule to enforce

For every task, the assignee must be **the owner themselves, or a descendant of the owner** in the reporting tree. That mirrors how visibility works: the owner and everyone above them in the chain can already see the task via RLS on `owner_id`; delegation only makes sense *downward* to your own team.

## Fix

A single data-repair migration (no schema change, no code change):

1. For each task where `assigned_to` is not in `{owner_id} ∪ descendants(owner_id)`, reassign it to `owner_id`. Leaf owners (like Anita) end up owning their own tasks, which is correct — they have no team to delegate to.
2. Verify: re-run the cross-hierarchy check; expected result is zero rows.

No RLS, UI, or seed-script changes are needed for this fix. If you'd also like me to add a DB-level trigger that *prevents* future out-of-tree assignments (so the app can't reintroduce this), say the word and I'll include it — but it's optional and the CRM UI can enforce it in the assignee picker instead.
