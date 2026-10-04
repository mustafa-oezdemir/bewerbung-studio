/**
 * Tabellarisch Template - Continuation Header Component
 * Simplified header for page 2+
 */

interface TabellarischContinuationHeaderProps {
  name: string;
  title?: string;
}

export function TabellarischContinuationHeader({
  name,
  title,
}: TabellarischContinuationHeaderProps) {
  return (
    <header className="tabellarisch-continuation-header">
      <p className="tabellarisch-continuation-header__name">{name}</p>
      {title && (
        <p className="tabellarisch-continuation-header__title">{title}</p>
      )}
    </header>
  );
}
