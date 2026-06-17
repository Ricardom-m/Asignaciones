interface Props {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}

// Encabezado consistente para todas las secciones.
export function PageHeader({ title, subtitle, right }: Props) {
  return (
    <div className="page-header">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {right && <div className="page-header-right">{right}</div>}
    </div>
  );
}
