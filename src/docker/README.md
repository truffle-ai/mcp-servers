# Docker Server

A Model Context Protocol server that provides a Docker sandbox environment for running code in isolated containers. This server enables LLMs to create and manage Docker containers, execute commands, upload/download files, install packages, and list workspace files.

## Components

### Tools

- **docker_create_container**

  - Creates a new Docker container for running code and processing data in a sandboxed environment.
  - Inputs:
    - `image` (string, optional): Docker image to use (default: `ubuntu:latest`).
    - `name` (string, optional): Optional name for the container.

- **docker_list_containers**

  - Lists all Docker containers, including the currently active container.
  - Inputs: none.

- **docker_execute_command**

  - Executes a command in the active Docker container.
  - Inputs:
    - `command` (string, required): The command to execute.
    - `container` (string, optional): Container name or ID.

- **docker_upload_file**

  - Creates a file in the container workspace with the specified content.
  - Inputs:
    - `fileName` (string, required): Name of the file.
    - `content` (string, required): Content to write to the file.
    - `container` (string, optional): Container name or ID.

- **docker_download_file**

  - Reads a file from the container workspace.
  - Inputs:
    - `filePath` (string, required): Path to the file.
    - `container` (string, optional): Container name or ID.

- **docker_install_package**

  - Installs a package in the Docker container.
  - Inputs:
    - `packageManager` (`apt` | `pip` | `npm`, required): Package manager to use.
    - `packages` (string[], required): List of packages to install.
    - `container` (string, optional): Container name or ID.

- **docker_run_script**

  - Runs a script in the container workspace with the specified interpreter.
  - Inputs:
    - `scriptPath` (string, required): Path to the script.
    - `interpreter` (string, required): Interpreter to use.
    - `args` (string[], optional): Arguments to pass.
    - `container` (string, optional): Container name or ID.

- **docker_stop_container**

  - Stops and optionally removes a Docker container.
  - Inputs:
    - `container` (string, optional): Container name or ID.
    - `remove` (boolean, optional): Remove container after stopping.

- **docker_list_workspace_files**

  - Lists files in the container workspace directory.
  - Inputs:
    - `directory` (string, optional): Directory within the workspace.
    - `container` (string, optional): Container name or ID.

## Usage

From the monorepo root:
```bash
npm install
npm run build --workspaces
```

Run the server:
```bash
cd src/docker
node dist/index.js
```

## Usage in MCP-clients

### NPX

```yaml
mcpServers:
  docker:
    command: npx
    args:
      - -y
      - "@truffle-ai/docker-server"
```

```json
{
  "mcpServers": {
    "docker": {
      "command": "npx",
      "args": ["-y", "@truffle-ai/docker-server"]
    }
  }
}
```

## License

MIT 