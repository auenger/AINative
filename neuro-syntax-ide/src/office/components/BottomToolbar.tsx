import { Button } from './ui/Button';

interface BottomToolbarProps {
  onOpenClaude: () => void;
}

export function BottomToolbar({ onOpenClaude }: BottomToolbarProps) {
  return (
    <div className="absolute bottom-10 left-10 z-20 flex items-center gap-4 pixel-panel p-4">
      <Button
        variant="accent"
        onClick={onOpenClaude}
        className="bg-accent hover:bg-accent-bright"
      >
        + Agent
      </Button>
    </div>
  );
}
