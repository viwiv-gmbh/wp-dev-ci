# Templates for consuming WordPress projects

Copy these into a plugin/theme/block repo that builds with the `wp-dev-ci`
image. Full walkthrough: [`../docs/WORDPRESS-CI-WORKFLOW.md`](../docs/WORDPRESS-CI-WORKFLOW.md).

| File | Copy to | Purpose |
| --- | --- | --- |
| `gitlab-ci-wordpress.yml` | not copied - referenced via `include:` | The pipeline itself (validate/test/build/release stages) |
| `releaserc.json` | `.releaserc.json` | semantic-release plugin chain and release rules |
| `wp-ci.config.plugin.example.json` | `wp-ci.config.json` | Version sources for a **plugin** project |
| `wp-ci.config.theme.example.json` | `wp-ci.config.json` | Version sources for a **theme** project |
| `wp-ci.config.block.example.json` | `wp-ci.config.json` | Version sources for a **block** project |
| `merge_request_templates/Default.md` | `.gitlab/merge_request_templates/Default.md` | Pre-fills the documentation-policy checklist on every new MR |
