import { NavLink } from "react-router-dom";
import { useStore } from "../store";
import { useCopy } from "../i18n";

export default function Layout({ children }) {
  const store = useStore();
  const t = useCopy(store.lang);
  return (
    <>
      <a className="skip" href="#conteudo">
        {t.skip}
      </a>
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <p className="word">MUNYI</p>
            <p className="tag">{t.tagline}</p>
          </div>
          <nav className="nav" aria-label="MUNYI">
            <NavLink to="/" end>
              {t.navMap}
            </NavLink>
            <NavLink to="/relato">{t.navReport}</NavLink>
            <NavLink to="/painel">{t.navDash}</NavLink>
            <NavLink to="/sobre">{t.navAbout}</NavLink>
          </nav>
          <div className="tools">
            <button type="button" className="tool" aria-pressed={store.contrast} onClick={store.toggleContrast}>
              {t.contrast}
            </button>
            <button type="button" className="tool" aria-pressed={store.largeText} onClick={store.toggleLarge}>
              {t.larger}
            </button>
            <button type="button" className="tool" onClick={() => store.setLang(store.lang === "en" ? "pt-MZ" : "en")}>
              {t.language}
            </button>
          </div>
        </div>
      </header>
      <main id="conteudo">{children}</main>
    </>
  );
}
