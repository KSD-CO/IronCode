<p align="center">
  <a href="https://ironcode.cloud">
    <picture>
      <source srcset="packages/console/app/src/asset/logo-ornate-dark.svg" media="(prefers-color-scheme: dark)">
      <source srcset="packages/console/app/src/asset/logo-ornate-light.svg" media="(prefers-color-scheme: light)">
      <img src="packages/console/app/src/asset/logo-ornate-light.svg" alt="IronCode logo">
    </picture>
  </a>
</p>
<p align="center">Performance-optimized AI coding agent fork of OpenCode</p>
<p align="center">
  <a href="https://github.com/anomalyco/opencode"><img alt="Upstream" src="https://img.shields.io/badge/upstream-opencode-blue?style=flat-square" /></a>
  <a href="https://github.com/anomalyco/ironcode/actions/workflows/publish.yml"><img alt="Build status" src="https://img.shields.io/github/actions/workflow/status/anomalyco/ironcode/publish.yml?style=flat-square&branch=dev" /></a>
</p>

[![IronCode Terminal UI](packages/web/src/assets/lander/screenshot.png)](https://ironcode.cloud)

---

## About This Fork

IronCode is a performance-focused fork of [OpenCode](https://github.com/anomalyco/opencode), the open-source AI coding agent. This fork aims to optimize critical performance bottlenecks by migrating core features from TypeScript/Node.js to Rust.

### Goals

- **Performance Optimization**: Migrate performance-critical components to Rust for faster execution
- **Lower Resource Usage**: Reduce memory footprint and CPU utilization
- **Maintain Compatibility**: Keep API compatibility with upstream OpenCode where possible
- **Upstream Contributions**: Contribute improvements back to the original OpenCode project when applicable

### Rust Migration Status

🚧 **In Progress**: Currently identifying and profiling core features for migration

Planned migrations:

- [ ] File system operations and glob matching
- [ ] Content search and pattern matching (grep functionality)
- [ ] Code parsing and AST operations
- [ ] LSP client optimizations
- [ ] Terminal UI rendering performance

### Why Rust?

- **Speed**: 10-100x faster execution for I/O and compute-intensive tasks
- **Memory Safety**: Eliminate entire classes of bugs without garbage collection overhead
- **Concurrency**: Fearless concurrency for parallel file operations
- **Native Performance**: Zero-cost abstractions and direct system calls

---

### Building From Source

```bash
# Clone the repository
git clone https://github.com/yourusername/ironcode.git
cd ironcode

# Install dependencies
bun install

# Build TypeScript components
bun run build

# Build Rust components (when available)
cd rust && cargo build --release

# Run locally
bun run dev
```

### Development

```bash
# Run tests
bun test

# Type checking
bun run typecheck

# Format code
bun run format
```

---

### Agents

IronCode includes two built-in agents you can switch between with the `Tab` key.

- **build** - Default, full-access agent for development work
- **plan** - Read-only agent for analysis and code exploration
  - Denies file edits by default
  - Asks permission before running bash commands
  - Ideal for exploring unfamiliar codebases or planning changes

Also included is a **general** subagent for complex searches and multistep tasks.
This is used internally and can be invoked using `@general` in messages.

Learn more about [agents](https://ironcode.cloud/docs/agents) in the upstream documentation.

---

### Contributing

Contributions are welcome! Please read our [contributing guidelines](./CONTRIBUTING.md) before submitting pull requests.

**Areas we're looking for help:**

- Rust migration of core features
- Performance profiling and benchmarking
- Testing and bug reports
- Documentation improvements

### Upstream Sync

This fork regularly syncs with [upstream OpenCode](https://github.com/anomalyco/opencode) to incorporate new features and bug fixes. We aim to contribute performance improvements back to the upstream project.

```bash
# To sync with upstream
git remote add upstream https://github.com/anomalyco/opencode.git
git fetch upstream
git merge upstream/dev
```

---

### License

This project maintains the same license as [OpenCode](https://github.com/anomalyco/opencode).

### Acknowledgments

- **OpenCode Team**: For creating the original open-source AI coding agent
- **Rust Community**: For providing excellent tools and libraries
- All contributors to this fork

---

**Links**

- [Upstream OpenCode](https://github.com/anomalyco/opencode)
- [OpenCode Documentation](https://ironcode.cloud/docs)
- [OpenCode Discord](https://discord.gg/ironcode)
