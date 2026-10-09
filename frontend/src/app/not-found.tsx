import Link from 'next/link';
import { Button } from '@/components/ui/Button';

export default function NotFound() {
  return (
    <div className="flex-grow flex items-center justify-center py-20 px-4">
      <div className="text-center">
        <h1 className="text-6xl font-extrabold text-primary mb-4">404</h1>
        <h2 className="text-3xl font-bold text-foreground mb-4">Page not found</h2>
        <p className="text-xl text-muted mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link href="/">
          <Button size="lg">Return Home</Button>
        </Link>
      </div>
    </div>
  );
}
