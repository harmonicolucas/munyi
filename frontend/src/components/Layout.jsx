import { NavLink } from "react-router-dom";
import { useStore } from "../store";
import { useCopy } from "../i18n";

export default function Layout({ children }) {
  const store = useStore();
  const t = useCopy(store.lang);
  const banner =
    store.mode === "checking" ? t.modeChecking : store.mode === "api" ? (store.health?.muse_configured ? t.modeApiReady : t.modeApi) : t.modeLocal;
  return (
    <>
      <a className="skip" href="#conteudo">
        {t.skip}
      </a>
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <div>
              <p className="word">MUNYI</p>
              <p className="tag">{t.tagline}</p>
            </div>
            <div className="tools">
              <button type="button" className="tool" aria-pressed={store.contrast} onClick={store.toggleContrast}>
                {t.contrast}
              </button>
              <button type="button" className="tool" aria-pressed={store.largeText} onClick={store.toggleLarge}>
                {t.larger}
              </button>
              <button type="button" className="tool" onClick={() => store.setLang(store.lang === "pt" ? "en" : "pt")}>
                {t.language}
              </button>
            </div>
          </div>
          <nav className="nav" aria-label="MUNYI">
            <NavLink to="/" end>
              {t.navReport}
            </NavLink>
            <NavLink to="/mapa">{t.navMap}</NavLink>
            <NavLink to="/painel">{t.navDash}</NavLink>
            <NavLink to="/sobre">{t.navAbout}</NavLink>
          </nav>
        </div>
      </header>
      <p className="banner" role="status">
        {banner}
      </p>
      <main id="conteudo">{children}</main>
    </>
  );
}
