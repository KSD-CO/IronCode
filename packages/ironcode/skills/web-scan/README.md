# web-scan

Active web security scanner. Probes a live URL for misconfigurations, exposed files, SSL issues, CORS policy, and more.

Works out of the box with only `curl` + `python3`. Install optional tools below for deeper scanning.

---

## Optional: Install Nikto

Nikto is a web server scanner that checks for 6,700+ known vulnerabilities and misconfigurations.

### macOS (Homebrew)

```bash
brew install nikto
```

### Ubuntu / Debian

```bash
sudo apt install nikto
```

### Manual (any OS with Perl)

```bash
git clone https://github.com/sullo/nikto.git
cd nikto/program
perl nikto.pl -h
```

Verify:

```bash
nikto -Version
```

---

## Optional: Install Nuclei

Nuclei runs community-maintained templates for CVEs, misconfigs, and exposed panels.

### macOS (Homebrew)

```bash
brew install nuclei
```

### Linux / macOS (Go binary)

```bash
go install -v github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest
```

### Update templates after install

```bash
nuclei -update-templates
```

Verify:

```bash
nuclei -version
```

---

## Usage

Once installed, invoke the skill:

```
/web-scan https://example.com
```

The skill auto-detects available tools and merges their output into the findings report.
