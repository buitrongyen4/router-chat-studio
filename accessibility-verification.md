# Accessibility Verification Report

**Project:** Router Chat Studio  
**Audit date:** 2026-08-26  
**Runner:** Chromium headless against the local development preview

## Scope and procedure

The audit script `scripts/accessibility-check.mjs` exercised the rendered application rather than inspecting source code only. It loaded the workspace, counted primary keyboard controls, tabbed through the interface, and checked that at least one focused control exposed a visible outline. It opened the Settings dialog and verified `role="dialog"`, `aria-modal="true"`, and associated controls for every visible form label. It pressed Escape and verified that the dialog closed. Finally, it calculated WCAG-style contrast ratios for representative foreground/background pairs used by the primary action, body text, and muted text.

## Results

| Check | Result | Evidence |
| --- | --- | --- |
| Keyboard-reachable primary controls | Pass | 15 buttons, inputs, textarea, and select controls discovered |
| Visible keyboard focus | Pass | `focusVisibleFound: true` while tabbing through the interface |
| Dialog semantics | Pass | Settings exposes `role="dialog"` and `aria-modal="true"` |
| Form label association | Pass | `labelsAreAssociated: true` for all settings labels |
| Escape dismissal | Pass | Settings dialog count returned to zero after Escape |
| Primary action contrast | Pass | 8.66:1 for `#351710` on `#e2b747` |
| Body text contrast | Pass | 10.86:1 for `#f6e8c7` on `#4e241b` |
| Muted text contrast | Pass | 5.23:1 for `#c39b81` on `#4e241b` |

## Conclusion

The explicit browser audit completed successfully. The interface provides semantic controls, visible keyboard focus, labelled settings fields, keyboard dismissal for overlays, and representative contrast ratios above the 4.5:1 target used for normal text checks. The audit is a focused product-level verification, not a substitute for a full assistive-technology certification across every browser and operating system.
