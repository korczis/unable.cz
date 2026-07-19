# Accessibility (PROMPT-09 §39)

- Old/new values are labelled in text ("Předchozí hodnota"/"Aktuální hodnota", "Přidáno"/"Odebráno") — never color-only; materiality/state additionally differ by font weight and never rely on red/green.
- Tables keep caption + th[scope]; graph comparison has a table alternative; timeline lanes are text-tagged per event ("událost ve světě" vs "pozorování evidence" vs "publikace dossieru").
- Filters are native <select>/<input type=search> with visible labels; filter results announced via aria-live. Keyboard: everything is links/selects/buttons; focus-visible outlines follow the site pattern; snapshot selection is a native select (keyboard-operable).
- Screen-reader arrow semantics: the visual "→" is aria-hidden with an sr-only textual replacement on change pages.
- Reduced motion: no new animations were introduced; existing reduceMotion checks untouched.
Known gap: no dedicated screen-reader end-to-end pass was run; WCAG 2.2 AA is targeted by construction, not certified.
