# Security policy

Athena is pre-1.0. Security fixes are developed on the default branch; there is
currently no commitment to maintain older release branches.

Report suspected vulnerabilities privately using the repository's **Security →
Advisories → Report a vulnerability** option when enabled. If unavailable, contact
a maintainer privately through the contact information on their GitHub profile.
Do not open a public issue containing exploit details, credentials or private data.

Include the affected commit/version, deployment configuration with secrets removed,
reproduction steps, impact, and any suggested fix. Use an isolated environment;
do not test against deployments you do not own. Response times are best effort.

Operators should follow `docs/deployment.md`, keep dependencies updated, use HTTPS,
protect setup with a deployment-specific token, and keep `.runtime` and backups
private. If credentials leak, revoke/rotate them first. Removing a Git commit does
not revoke credentials already copied by someone else.
