import { contactIconPaths, resolveContactIcon, type ContactIconDescriptor } from "../../../shared/contactIcons";

export function ContactIcon(props: ContactIconDescriptor) {
  const kind = resolveContactIcon(props);
  return <svg aria-hidden="true" data-contact-icon={kind === "portfolio" ? "website" : kind} viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0 }} dangerouslySetInnerHTML={{ __html: contactIconPaths[kind] }} />;
}
