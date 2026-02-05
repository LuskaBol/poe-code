FROM node:22

# Install uv for Python tools
RUN curl -LsSf https://astral.sh/uv/install.sh | sh -s -- --quiet
ENV PATH="/root/.local/bin:$PATH"

WORKDIR /build

# Copy package files first (layer caching)
COPY package.json package-lock.json turbo.json tsconfig.json tsconfig.build.json ./
COPY packages/ ./packages/

# Install dependencies
RUN npm ci

# Copy source and scripts
COPY src/ ./src/
COPY scripts/ ./scripts/

# Build and install globally
RUN npm run build && npm install -g .

# Pre-install all agents
RUN poe-code install claude-code && \
    poe-code install codex && \
    poe-code install kimi && \
    poe-code install opencode

WORKDIR /workspace
