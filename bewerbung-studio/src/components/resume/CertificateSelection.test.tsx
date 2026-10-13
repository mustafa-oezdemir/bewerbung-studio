import { renderToStaticMarkup } from "react-dom/server";
import { parseHTML } from "linkedom";
import { describe, expect, it } from "vitest";
import { moveListItem } from "../../shared/listOrder";
import { certificateEntries } from "../../shared/certificates";
import { profileSchema } from "../../shared/schema";
import { CertificateListEditor } from "../profile/EntryListEditor";
import {
  CertificateSelection, certificateSelectionRows, filterCertificateRows, selectAllCertificates, toggleCertificate,
} from "./CertificateSelection";

// Fictional certificates only.
const profile = profileSchema.parse({
  id: "f2000000-0000-4000-8000-000000000001", isDefault: true, firstName: "Lena", lastName: "Beispiel",
  updatedAt: "2026-10-10T09:00:00.000Z",
  certifications: ["01/2026 · Fiktiver Cloud-Kurs · Akademie Nord", "02/2026 · Erdachter Go-Kurs · Lernwerk Süd", "03/2026 · Musterkurs Daten · Akademie Nord"],
});
const entries = certificateEntries(profile);
const [a, b, c] = entries.map((entry) => entry.id);
const render = (selectedIds: string[] | undefined, initialQuery = "") => parseHTML(`<html><body>${renderToStaticMarkup(
  <CertificateSelection entries={entries} selectedIds={selectedIds} onChange={() => undefined} initialQuery={initialQuery} />,
)}</body></html>`).document;

describe("Zertifikate auswählen", () => {
  it("lists every profile certificate with name, provider, date and its own checkbox", () => {
    const document = render(undefined);
    const items = [...document.querySelectorAll(".certificate-selection__list > li")];
    expect(items).toHaveLength(3);
    expect(items[1].textContent).toContain("Erdachter Go-Kurs");
    expect(items[1].textContent).toContain("Lernwerk Süd");
    expect(items[1].textContent).toContain("02/2026");
    expect(items[1].querySelector('input[type="checkbox"]')?.getAttribute("aria-label")).toBe("Erdachter Go-Kurs: Im Lebenslauf anzeigen");
    // Without a choice every certificate is in the Lebenslauf.
    expect(document.body.textContent).toContain("Ausgewählt: 3 von 3 Zertifikaten");
    expect(document.querySelector('input[type="search"]')?.getAttribute("placeholder")).toBe("Zertifikate suchen …");
    expect([...document.querySelectorAll("button")].map((button) => button.textContent)).toEqual(expect.arrayContaining(["Alle auswählen", "Auswahl aufheben"]));
  });

  it("shows the chosen certificates first, in the chosen order, with order controls; the rest unticked", () => {
    const document = render([c, a]);
    const items = [...document.querySelectorAll(".certificate-selection__list > li")];
    expect(items.map((item) => item.querySelector("strong")?.textContent)).toEqual(["Musterkurs Daten", "Fiktiver Cloud-Kurs", "Erdachter Go-Kurs"]);
    expect(items.map((item) => item.querySelector('input[type="checkbox"]')?.hasAttribute("checked"))).toEqual([true, true, false]);
    expect(items[0].querySelector(".order-controls")).not.toBeNull();
    expect(items[2].querySelector(".order-controls")).toBeNull();
    expect(document.body.textContent).toContain("Ausgewählt: 2 von 3 Zertifikaten");
    expect(render([]).body.textContent).toContain("Ausgewählt: 0 von 3 Zertifikaten");
  });

  it("ticks one or several, selects all, clears and reorders", () => {
    expect(toggleCertificate([], b, true)).toEqual([b]);
    expect(toggleCertificate([b], a, true)).toEqual([b, a]);
    expect(toggleCertificate([b, a], b, false)).toEqual([a]);
    expect(selectAllCertificates(entries, [c])).toEqual([c, a, b]);
    expect(moveListItem([c, a, b], 2, 0)).toEqual([b, c, a]);
    // Without a choice, the first change starts from every certificate.
    expect(toggleCertificate(certificateSelectionRows(entries, undefined).selected, b, false)).toEqual([a, c]);
  });

  it("searches only the list on screen, never the choice", () => {
    const rows = certificateSelectionRows(entries, [a]).rows;
    expect(filterCertificateRows(rows, "akademie nord").map((row) => row.entry.id)).toEqual([a, c]);
    const document = render([a], "go-kurs");
    expect([...document.querySelectorAll(".certificate-selection__list > li strong")].map((node) => node.textContent)).toEqual(["Erdachter Go-Kurs"]);
    expect(document.body.textContent).toContain("Ausgewählt: 1 von 3 Zertifikaten");
    expect(render([a], "nichts").body.textContent).toContain("Kein Zertifikat passt zur Suche.");
  });

  it("offers „Liste einfügen“ in the Profil's certificate editor", () => {
    const document = parseHTML(`<html><body>${renderToStaticMarkup(
      <CertificateListEditor profile={profile} onChange={() => undefined} />,
    )}</body></html>`).document;
    expect(document.querySelector(".certificate-list-editor__paste summary")?.textContent).toBe("Liste einfügen");
    expect(document.querySelectorAll(".certificate-list-editor__card")).toHaveLength(3);
  });
});
