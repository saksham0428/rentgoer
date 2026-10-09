import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Search, ShieldCheck, Home } from 'lucide-react';
import { api } from '@/lib/api';

export const dynamic = 'force-dynamic';

async function getCurrentUser() {
  try {
    const res = await api.get<{ success: boolean; user: any }>('/auth/me');
    return res.user;
  } catch {
    return null;
  }
}

export default async function HomePage() {
  const user = await getCurrentUser();
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="bg-card pt-16 pb-24 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-5xl md:text-6xl font-extrabold text-foreground tracking-tight mb-6">
            Find your place.<br />
            <span className="text-primary">Skip the broker.</span>
          </h1>
          <p className="mt-4 text-xl text-muted max-w-2xl mx-auto mb-10">
            The modern direct rental marketplace connecting tenants and property owners. 
            Zero hidden fees, pure transparency.
          </p>
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
            {user?.role === 'OWNER' ? (
              <Link href="/owner">
                <Button size="lg" className="w-full sm:w-auto font-semibold text-lg px-8 py-4">
                  Owner Dashboard
                </Button>
              </Link>
            ) : (
              <Link href="/properties">
                <Button size="lg" className="w-full sm:w-auto font-semibold text-lg px-8 py-4">
                  {user?.role === 'TENANT' ? 'Browse Properties' : 'Find a Property'}
                </Button>
              </Link>
            )}

            {!user && (
              <Link href="/register?role=OWNER">
                <Button variant="outline" size="lg" className="w-full sm:w-auto font-semibold text-lg px-8 py-4 bg-transparent hover:bg-muted/5 text-foreground border-border">
                  List Your Property
                </Button>
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Value Props */}
      <section className="py-20 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div className="text-center flex flex-col items-center">
              <div className="bg-primary/10 p-4 rounded-full mb-6 text-primary">
                <Search className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-3">Direct Discovery</h3>
              <p className="text-muted leading-relaxed">
                Browse hundreds of verified listings directly from property owners. No middlemen, no confusion.
              </p>
            </div>
            
            <div className="text-center flex flex-col items-center">
              <div className="bg-success/10 p-4 rounded-full mb-6 text-success">
                <ShieldCheck className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-3">Verified Owners</h3>
              <p className="text-muted leading-relaxed">
                We ensure that you deal with legitimate property owners to create a safe and trustworthy marketplace.
              </p>
            </div>
            
            <div className="text-center flex flex-col items-center">
              <div className="bg-primary/10 p-4 rounded-full mb-6 text-primary">
                <Home className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-3">Zero Brokerage</h3>
              <p className="text-muted leading-relaxed">
                Keep your hard-earned money. Connect and sign leases directly with zero brokerage fees.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
