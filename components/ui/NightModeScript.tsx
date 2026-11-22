/**
 * Applies night mode before the first paint, so the page does not flash white while the
 * store hydrates. Reads the same saved settings the store does (localStorage "profileV3").
 */
const SCRIPT = `try{if(JSON.parse(localStorage.getItem("profileV3")||"{}").enableNightMode)document.documentElement.classList.add("dark")}catch(e){}`;

export function NightModeScript() {
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />;
}
