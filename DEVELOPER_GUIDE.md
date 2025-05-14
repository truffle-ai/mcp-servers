# Developer Guide

## Testing with Saiki

Follow these steps to test any MCP server locally in Saiki using `npm link`:

1. Build the monorepo

   ```bash
   npm install
   npm run build --workspaces
   ```

2. Link your server package globally

   ```bash
   cd src/<server-directory>
   npm link
   ```

   - Replace `<server-directory>` with the folder name under `src` (e.g., `puppeteer`).

3. Link the package into your client project

   ```bash
   cd /path/to/saiki
   npm link @truffle-ai/<npm-package-name>
   ```

   - `<npm-package-name>` is the `name` field in the server's `package.json` (e.g., `puppeteer-server`).

4. Update your client's MCP config (YAML or JSON) to point to the linked package

   YAML example:
   ```yaml
   mcpServers:
     <server-key>:
       command: npx
       args:
         - "@truffle-ai/<npm-package-name>"
   ```

   JSON example:
   ```json
   {
     "mcpServers": {
       "<server-key>": {
         "command": "npx",
         "args": ["@truffle-ai/<npm-package-name>"]
       }
     }
   }
   ```

   - `<server-key>` typically matches the directory name (e.g., `puppeteer`).
   - With the link in place, running your client will launch the locally built server as if it were published.

---

**Notes:**

- After making code changes in your server, re-run `npm run build --workspaces` in the monorepo root to update the dist output.
- If you prefer not to use `npm link`, you can also use `npm pack` to create a tarball (`.tgz`) and install that in your client via `file:` dependencies. 