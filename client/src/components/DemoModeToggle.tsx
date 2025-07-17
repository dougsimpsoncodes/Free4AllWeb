import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, EyeOff } from "lucide-react";

interface DemoModeToggleProps {
  onToggle: (isDemo: boolean) => void;
}

export default function DemoModeToggle({ onToggle }: DemoModeToggleProps) {
  const [isDemo, setIsDemo] = useState(false);

  const handleToggle = () => {
    const newDemoState = !isDemo;
    setIsDemo(newDemoState);
    onToggle(newDemoState);
  };

  return (
    <div className="fixed top-4 right-4 z-50">
      <Button
        onClick={handleToggle}
        variant={isDemo ? "default" : "outline"}
        size="sm"
        className="gap-2"
      >
        {isDemo ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        {isDemo ? "Demo Mode ON" : "Enable Demo Mode"}
      </Button>
      {isDemo && (
        <Badge variant="secondary" className="ml-2">
          Viewing as authenticated user
        </Badge>
      )}
    </div>
  );
}