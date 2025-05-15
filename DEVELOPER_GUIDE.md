# Developer Guide

## Testing with [Saiki](https://github.com/truffle-ai/saiki)

Follow these steps to test any MCP server locally in Saiki using `npm link`. This is useful if you are updating the MCP servers and want to test it before publishing.

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

4. Run the server locally to verify

   In saiki repo

   ```bash
   npx -y @truffle-ai/<npm-package-name>
   ```

   - `<npm-package-name>` is the `name` field in the server's `package.json` (e.g., `puppeteer-server`).

5. Update your client's MCP config (YAML or JSON) to point to the linked package

   YAML example for Saiki:
   ```yaml
   mcpServers:
     <server-key>:
       command: npx
       args:
         - -y
         - "@truffle-ai/<npm-package-name>"
   ```

   JSON example:
   ```json
   {
     "mcpServers": {
       "<server-key>": {
         "command": "npx",
         "args": ["-y", "@truffle-ai/<npm-package-name>"]
       }
     }
   }
   ```

   - `<server-key>` typically matches the directory name (e.g., `puppeteer`).
   - With the link in place, running `npx -y @truffle-ai/<npm-package-name>` will launch the locally built server as if it were published.


**After testing**

When you've finished testing and want to restore normal npm behavior (so that `npx -y @truffle-ai/<npm-package-name>` pulls from the registry), run:

1. In your client project (e.g., Saiki):

   ```bash
   cd /path/to/saiki
   npm unlink @truffle-ai/<npm-package-name>
   ```

2. In your server package (remove the global link):

   ```bash
   cd /Users/karaj/Projects/mcp-servers/src/<server-directory>
   npm unlink -g @truffle-ai/<npm-package-name>
   ```

After unlinking, `npx -y @truffle-ai/<npm-package-name>` will install and run the latest published version from npm. 

**Publish to npm**

For maintainers: Once the server is tested and works correctly, publish to npm:

1. Bump the version (patch/minor/major):
   ```bash
   cd src/<server-directory>
   npm version patch
   ```

2. Publish to npm:
   ```bash
   npm publish --access public
   ```

3. Push commits and tags to remote:
   ```bash
   git push
   git push --tags
   ```

After publishing, clients can install the new version using the same command:

```bash
npx -y @truffle-ai/<npm-package-name>
```

---

**Notes:**

- After making code changes in your server, re-run `npm run build --workspaces` in the monorepo root to update the dist output.
- If you prefer not to use `npm link`, you can also use `npm pack` to create a tarball (`.tgz`) and install that in your client via `file:` dependencies.