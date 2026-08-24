# Contributing to Simple ScreenShot

Thanks for helping improve Simple ScreenShot. Bug reports, documentation fixes, translations, design feedback, and code contributions are welcome.

## Before opening an issue

- Confirm that the problem occurs on Ubuntu 24.04 with GNOME Shell 46.
- Run `make check` from the repository root.
- Search existing issues for the same problem.
- Remove private information from screenshots and logs.

## Development setup

Ubuntu 24.04 normally includes the runtime dependencies. The project additionally uses Node.js for syntax and geometry tests.

```bash
git clone https://github.com/Aero123421/SimpleScreenShot.git
cd SimpleScreenShot
make check
make run-editor
```

Install the development build with `make install`. A newly installed extension may require one logout/login cycle before GNOME Shell discovers it.

## Pull requests

1. Keep changes focused on one problem.
2. Add or update tests when behavior changes.
3. Run `make check` before submitting.
4. Explain user-visible behavior and GNOME Shell compatibility in the description.
5. Use original or freely licensed visual assets only.

Contributions are accepted under the repository's dual license: `Apache-2.0 OR GPL-3.0-or-later`.
