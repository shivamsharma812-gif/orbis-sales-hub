## Connect project to GitHub for cross-platform development

### Goal
Link the Orbis CRM project to a GitHub repository so the code can be opened and edited in Cursor, ChatGPT, Claude, VS Code, or any other editor that supports GitHub repos.

### Steps

1. **Initiate GitHub connection from Lovable**
   - Open the **Plus (+)** menu in the chat input → **GitHub** → **Connect project**.
   - Authorize the Lovable GitHub App when prompted.
   - Select the GitHub account/organization where the repo should live.
   - Click **Create Repository** in Lovable.

2. **Verify initial sync**
   - Confirm the repo appears in the selected GitHub account.
   - Check that the latest project files have been pushed to the default branch.
   - Note that Supabase migrations, seed data, and secrets are not part of the code export.

3. **Document safe cross-platform workflow**
   - Use GitHub as the single source of truth.
   - Pull latest changes before editing in Cursor/Claude/ChatGPT.
   - Push changes back to GitHub; Lovable will sync them automatically.
   - Avoid editing the same files simultaneously in Lovable and another editor to prevent merge conflicts.

4. **Post-connection notes**
   - Environment variables (Supabase keys, secrets, connector keys) must be re-created or copied manually in any new environment.
   - Database data requires a separate export via **Cloud → Advanced settings → Export data** if needed.

### Outcome
The project code will be available on GitHub, enabling ongoing development across multiple platforms while keeping Lovable as the primary builder.