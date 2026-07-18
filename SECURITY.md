# Security Policy

## Supported versions

Security fixes are applied to the latest code on the default branch. If you are running an older commit, upgrade before reporting unless the issue still reproduces on `master`.

## Reporting a vulnerability

**Do not** open a public GitHub issue for security vulnerabilities.

Please report security concerns privately using one of these options:

1. **GitHub private vulnerability reporting** — open a draft security advisory on the [QuayPanel repository](https://github.com/QuayPanel/quaypanel/security/advisories/new) (preferred).
2. If private reporting is unavailable, contact the maintainers via a **private** channel linked from the [QuayPanel organization](https://github.com/QuayPanel) (for example a maintainer email listed on their GitHub profile). Do not include exploit details in public discussions.

### What to include

- Affected version or commit hash
- Description of the issue and impact
- Steps to reproduce (or a proof of concept)
- Whether the issue is already being exploited (if known)

### What to expect

- We will acknowledge valid reports as soon as practical
- We may ask for more detail to confirm and fix the issue
- Please give us a reasonable window to release a fix before any public disclosure
- Credit will be given to reporters who wish to be named, unless they prefer to remain anonymous

## Scope

In scope examples:

- Authentication or authorization bypass
- Injection (SQL, command, template, etc.)
- Remote code execution
- Sensitive data exposure
- Privilege escalation between client and admin portals
- Insecure handling of payment webhooks, API keys, or session tokens

Out of scope examples:

- Denial of service from volumetric traffic alone
- Issues that require physical access or an already-compromised server
- Reports based only on outdated dependencies without a demonstrated impact in this project
- Social engineering of individual users or maintainers

## Safe harbor

We consider good-faith security research conducted within this policy to be authorized. We will not pursue legal action against researchers who:

- Make a good-faith effort to avoid privacy violations, data destruction, and service disruption
- Do not exploit the issue beyond what is needed to demonstrate it
- Report findings promptly through the private channels above
- Do not publicly disclose the issue until a fix is available, or we agree otherwise
