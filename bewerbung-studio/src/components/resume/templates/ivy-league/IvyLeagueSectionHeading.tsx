export function IvyLeagueSectionHeading({
  children,
  continuation = false,
}: {
  children: string;
  continuation?: boolean;
}) {
  return (
    <h2 className="ivy-league-section__title">
      {children}
      {continuation ? <small>Fortsetzung</small> : null}
    </h2>
  );
}
