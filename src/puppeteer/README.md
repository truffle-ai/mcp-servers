# Puppeteer

A Model Context Protocol server that provides browser automation capabilities using Puppeteer. This server enables LLMs to interact with web pages, execute actions like clicking and typing, retrieve content, scroll, wait for selectors, check for CAPTCHA, download images/files, and list interactable elements.

## Components

### Tools

- **puppeteer_navigate**

  - Navigate to any URL in the browser
  - Inputs:
    - `url` (string, required): The full URL to navigate to (including `https://` or `http://`).

- **puppeteer_click**

  - Click an element matching a CSS selector
  - Inputs:
    - `selector` (string, required): CSS selector targeting the element to click.
    - `forceVisible` (boolean, optional, default: false): Scroll element into view before clicking.
    - `index` (number, optional): Index of the element if multiple match (0-based).
    - `waitAfter` (number, optional, default: 1000): Milliseconds to wait after clicking.

- **puppeteer_type**

  - Type text into an input field
  - Inputs:
    - `selector` (string, required): CSS selector for the input field.
    - `text` (string, required): Text to type.
    - `clearFirst` (boolean, optional, default: true): Whether to clear the field before typing.
    - `delay` (number, optional, default: 50): Delay in milliseconds between keystrokes.

- **puppeteer_get_content**

  - Retrieve content from the page or a specific element
  - Inputs:
    - `selector` (string, optional): CSS selector to get content from (default: `body`).
    - `format` (`"text" | "html" | "simplified_dom"`, optional, default: `"simplified_dom"`): Format of the content.
    - `maxChars` (number, optional, default: 12000): Maximum characters to return.
    - `prioritizeContent` (boolean, optional, default: true): Prioritize main content when truncating.

- **puppeteer_scroll**

  - Scroll the page window vertically
  - Inputs:
    - `direction` (`"up" | "down" | "top" | "bottom"`, required): Direction to scroll.

- **puppeteer_wait_for_selector**

  - Wait for an element to appear in the DOM
  - Inputs:
    - `selector` (string, required)
    - `timeout` (number, optional, default: 15000): Maximum time in milliseconds to wait.
    - `visible` (boolean, optional, default: false): Wait for the element to be visible.

- **puppeteer_check_for_captcha**

  - Check for common CAPTCHA challenges (e.g., reCAPTCHA, hCaptcha)
  - Inputs: None

- **puppeteer_element_exists**

  - Check if an element exists without waiting
  - Inputs:
    - `selector` (string, required)

- **puppeteer_wait_for_load**

  - Wait for page load using various strategies
  - Inputs:
    - `strategy` (`"networkidle" | "domcontentloaded" | "load" | "visual"`, optional, default: `"networkidle"`)
    - `timeout` (number, optional, default: 15000)

- **puppeteer_download_image**

  - Download an image from a page to a local file
  - Inputs:
    - `imageUrl` (string, optional)
    - `selector` (string, optional)
    - `outputPath` (string, required)
    - `attribute` (string, optional, default: `"src"`)

- **puppeteer_download_file**

  - Download any file (images, PDFs, ZIPs, etc.) to a local path
  - Inputs:
    - `url` (string, optional)
    - `selector` (string, optional)
    - `outputPath` (string, required)
    - `attribute` (string, optional, default: `"href"`)
    - `clickToDownload` (boolean, optional, default: false)

- **puppeteer_list_interactables**

  - List interactable elements (links, buttons, inputs, selects, textareas) on the page
  - Inputs:
    - `maxResults` (number, optional, default: 50)

## Key Features

- Browser automation (navigation, clicking, typing)
- Content retrieval and DOM simplification
- Scrolling and waiting for dynamic content
- CAPTCHA detection
- Element existence checks
- Customizable load strategies
- Downloading images and files
- Listing interactable elements

## Usage inside repo code

From the monorepo root:
```bash
npm install
npm run build --workspaces
```

Run the server:
```bash
cd src/puppeteer
node dist/index.js
```

## Usage in MCP-clients

### NPX

Use with [Saiki](https://github.com/truffle-ai/saiki)
```yaml
mcpServers:
  puppeteer:
    command: npx
    args:
      - -y
      - "@truffle-ai/puppeteer-server"
```

Use with other clients (Cursor, Claude desktop, etc.)
```json
{
  "mcpServers": {
    "puppeteer": {
      "command": "npx",
      "args": ["-y", "@truffle-ai/puppeteer-server"]
    }
  }
}
```

## Testing with Saiki


## License

MIT 