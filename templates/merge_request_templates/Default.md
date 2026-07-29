<!--
  Copy this file to .gitlab/merge_request_templates/Default.md in the
  consuming project so GitLab pre-fills every new MR description with it.
  The "Documentation" section below is machine-checked by
  check-documentation.mjs - do not rename the options or remove the
  checkbox markup, or the CI job will fail to find them.
-->

## Summary

<!-- What does this change do, and why? -->

## Documentation

<!-- Check exactly ONE box. CI fails the MR if zero or more than one is checked. -->

- [ ] No documentation changes required
- [ ] README updated
- [ ] WordPress readme updated
- [ ] Developer documentation updated
- [ ] Migration documentation updated

## Checklist

- [ ] MR title follows Conventional Commits (e.g. `feat(scope): add thing`, `fix: correct thing`)
- [ ] CHANGELOG.md and version numbers were **not** edited by hand - semantic-release owns them
