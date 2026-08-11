export default function PageHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-xl font-bold text-navy sm:text-2xl">{title}</h1>
      {description && <p className="mt-1.5 text-sm text-body">{description}</p>}
    </div>
  );
}
