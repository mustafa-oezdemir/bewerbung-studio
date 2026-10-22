import { ZweispaltigResume } from "../zweispaltig/ZweispaltigResume";
import type { TuerkisProfilResumeProps } from "./tuerkis-profil.types";
import "./tuerkis-profil.css";

/** Uses the shared two-column content/page plan; this template owns its presentation. */
export function TuerkisProfilResume(props: TuerkisProfilResumeProps) {
  return <ZweispaltigResume {...props} variant="tuerkis-profil" />;
}
