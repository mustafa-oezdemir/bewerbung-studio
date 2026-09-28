import type { ApplicantProfile } from "./schema";
import type { DocumentDesignSettings } from "./documentDesign";
import { getProfileMediaSource } from "./profileMedia";

export const resumeClosingCss = `
[data-resume-closing]{display:flex;flex-wrap:wrap;align-items:end;gap:2mm 6mm;grid-column:1/-1;min-width:0;margin-top:5mm;padding-top:2mm;border-top:.2mm solid var(--doc-divider-color,#cbd5e1);break-inside:avoid;font-size:9pt;line-height:1.25}
[data-resume-closing-placement="footer"]{position:absolute;z-index:3;right:12mm;bottom:12mm;left:12mm;margin-top:0;background:var(--doc-background-color,#fff)}
[data-resume-closing]>*{min-width:0;overflow-wrap:anywhere}
[data-resume-closing][data-resume-closing-align="left"]{justify-content:flex-start;text-align:left}
[data-resume-closing][data-resume-closing-align="center"]{justify-content:center;text-align:center}
[data-resume-closing][data-resume-closing-align="right"]{justify-content:flex-end;text-align:right}
[data-resume-closing][data-resume-closing-align="distributed"]{justify-content:space-between;text-align:left}
[data-resume-closing-signature]{display:flex;flex-direction:column;align-items:inherit;max-width:48mm}
[data-resume-closing-signature] img{display:block;max-width:48mm;max-height:14mm;width:auto;height:auto;object-fit:contain}
[data-resume-closing-signature] strong{font-size:8pt;font-weight:600}
`;

const germanDate = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  return match ? `${match[3]}.${match[2]}.${match[1]}` : value.trim();
};

/** Add one shared closing on the final page while retaining an untouched Pehlione default. */
export const applyResumeClosingOutput = (
  page: Element,
  main: Element,
  profile: ApplicantProfile,
  templateId: string,
  settings: DocumentDesignSettings,
  lastPage: boolean,
  visible: boolean,
): void => {
  const native = page.querySelectorAll("footer.pehlione-closing,footer.pehlione-pdf-closing");
  if (!lastPage || !visible) {
    native.forEach(node => node.remove());
    return;
  }
  const choice = settings.resumePresentation?.closing;
  const pehlione = templateId.startsWith("pehlione_");
  if (pehlione && !choice?.placement && !choice?.alignment) return;
  const signature = profile.resumeClosing.showSignature ? getProfileMediaSource(profile.signaturePath) : "";
  const hasExplicitContent = Boolean(profile.applicationPlace.trim() || profile.applicationDate.trim() || signature);
  if (!pehlione && !hasExplicitContent && !choice) return;
  const place = profile.resumeClosing.showPlace ? (profile.applicationPlace || profile.city).trim() : "";
  const date = profile.resumeClosing.showDate ? germanDate(profile.applicationDate) : "";
  if (!place && !date && !signature) {
    native.forEach(node => node.remove());
    return;
  }
  native.forEach(node => node.remove());
  const document = page.ownerDocument;
  const block = document.createElement("div");
  const placement = choice?.placement ?? "footer";
  block.setAttribute("data-resume-closing", "");
  block.setAttribute("data-resume-closing-placement", placement);
  block.setAttribute("data-resume-closing-align", choice?.alignment ?? (pehlione ? "distributed" : "left"));
  if (place) {
    const element = document.createElement("span");
    element.setAttribute("data-resume-closing-place", "");
    element.textContent = place;
    block.appendChild(element);
  }
  if (date) {
    const element = document.createElement("time");
    element.setAttribute("data-resume-closing-date", "");
    element.textContent = date;
    block.appendChild(element);
  }
  if (signature) {
    const holder = document.createElement("span");
    holder.setAttribute("data-resume-closing-signature", "");
    const image = document.createElement("img");
    image.setAttribute("src", signature);
    image.setAttribute("alt", "Unterschrift");
    holder.appendChild(image);
    const name = [profile.firstName, profile.lastName].filter(Boolean).join(" ");
    if (name) {
      const label = document.createElement("strong");
      label.textContent = name;
      holder.appendChild(label);
    }
    block.appendChild(holder);
  }
  const destination = placement === "main"
    ? (page.querySelector('[data-resume-layout-zone="main"]') ?? main)
    : (page.matches(".cv-sheet") ? page : page.firstElementChild ?? main);
  if (placement === "footer") (destination as HTMLElement).style.position = "relative";
  destination.appendChild(block);
};
