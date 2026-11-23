// First stop of the keyboard on every page: straight to the content
export function SkipLink() {
  return (
    <a
      href="#contenu"
      className="oc-btn oc-btn--primary sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-10"
    >
      Aller au contenu
    </a>
  );
}
