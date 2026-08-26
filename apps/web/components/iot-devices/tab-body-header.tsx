interface TabBodyHeaderProps {
  title: string;
  description: string;
}

/**
 * The uniform opening of every tab body: one scale, one place. Some tabs used
 * to start headingless, others at off-scale sizes; a tab always says what it
 * is and what it is for before showing anything else.
 */
export function TabBodyHeader({ title, description }: TabBodyHeaderProps) {
  return (
    <div className="mb-6 space-y-1">
      <h2 className="text-lg font-medium">{title}</h2>
      <p className="text-muted-foreground text-sm">{description}</p>
    </div>
  );
}
