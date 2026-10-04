export function KreativSectionHeading({
  title,
  continuation = false,
}: {
  title: string;
  continuation?: boolean;
}) {
  return (
    <h2 className="kreativ-section__title">
      {title}
      {continuation ? <small>Fortsetzung</small> : null}
    </h2>
  );
}
