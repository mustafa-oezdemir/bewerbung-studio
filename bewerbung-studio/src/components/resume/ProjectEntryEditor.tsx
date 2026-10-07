import type { ApplicantProfile } from "../../shared/schema";
import { EntryListEditor } from "../profile/EntryListEditor";

type ProjectEntry = ApplicantProfile["specialSections"][number]["entries"][number];

/** One project editor for the profile catalogue and the résumé section editor. */
export function ProjectEntryEditor({ entry, onChange }: {
  entry: ProjectEntry;
  onChange: (change: Partial<ProjectEntry>) => void;
}) {
  return <div className="resume-project-fields">
    <label className="field"><span>Projektname</span>
      <input value={entry.title} onChange={(event) => onChange({ title: event.target.value })} />
    </label>
    <label className="field"><span>Repository</span>
      <input type="url" value={entry.url} placeholder="https://github.com/..."
        onChange={(event) => onChange({ url: event.target.value })} />
    </label>
    <div className="field resume-project-technology-editor"><span>Technologien</span>
      <EntryListEditor values={entry.technologies} placeholder="z. B. ASP.NET Core MVC"
        addLabel="Technologie hinzufügen" emptyText="Noch keine Technologie erfasst."
        onChange={(technologies) => onChange({ technologies })} />
    </div>
    <label className="field"><span>Kurzbeschreibung</span>
      <textarea rows={3} value={entry.description}
        onChange={(event) => onChange({ description: event.target.value })} />
    </label>
    <details className="resume-project-details"><summary>Details / Erfolge</summary>
      <EntryListEditor values={entry.bullets} multiline addLabel="Punkt hinzufügen"
        emptyText="Noch kein Punkt erfasst." onChange={(bullets) => onChange({ bullets })} />
    </details>
  </div>;
}
