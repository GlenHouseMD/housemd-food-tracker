import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 text-center">
      <h2 className="text-lg font-semibold mb-2">Page Not Found</h2>
      <p className="text-sm text-muted-foreground mb-4">The page you're looking for doesn't exist.</p>
      <Link href="/">
        <Button variant="outline" size="sm">Back to Dashboard</Button>
      </Link>
    </div>
  );
}
