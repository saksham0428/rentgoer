import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/Button';
import { PropertyCard } from '@/components/ui/PropertyCard';
import {
  Search,
  ShieldCheck,
  Home,
  MapPin,
  ArrowRight,
  BadgePercent,
  MessageSquare,
  CheckCircle2,
  Building2
} from 'lucide-react';
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

async function getFeaturedProperties() {
  try {
    const res = await api.get<{
      success: boolean;
      data: any[];
    }>('/properties', { params: { limit: 4, sortBy: 'newest' } });
    return res.data || [];
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const [user, featuredProperties] = await Promise.all([
    getCurrentUser(),
    getFeaturedProperties(),
  ]);

  return (
    <div className="flex flex-col w-full overflow-hidden">
      {/* 1. Hero Section */}
      <section className="relative bg-gradient-to-b from-card via-background to-background pt-12 pb-20 md:pt-16 md:pb-28 border-b border-border/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">

            {/* Left Content Column */}
            <div className="lg:col-span-7 flex flex-col text-left">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-primary-light text-primary mb-6 w-fit border border-primary/10">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                <span>The Direct Rental Marketplace</span>
              </div>

              <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-foreground tracking-tight leading-[1.12] mb-6">
                Find your place.<br />
                <span className="text-primary">Skip the broker.</span>
              </h1>

              <p className="text-base sm:text-lg text-muted max-w-xl mb-8 leading-relaxed">
                Connect directly with verified property owners. Experience transparent pricing,
                real-time chats, and verified agreements with zero brokerage fees.
              </p>

              {/* Prominent Hero Search Card */}
              <div className="bg-card p-3 sm:p-4 rounded-2xl border border-border shadow-md max-w-xl">
                <form action="/properties" method="GET" className="flex flex-col sm:flex-row gap-2.5">
                  <div className="relative flex-grow">
                    <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted/70" />
                    <input
                      type="text"
                      name="city"
                      placeholder="City (e.g. Bengaluru, Mumbai)"
                      className="w-full pl-10 pr-3.5 py-2.5 bg-background border border-border rounded-xl text-sm placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    />
                  </div>
                  <div className="relative flex-grow">
                    <input
                      type="text"
                      name="locality"
                      placeholder="Locality / Neighborhood"
                      className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    />
                  </div>
                  <Button type="submit" size="md" className="px-6 font-semibold flex items-center justify-center gap-2 whitespace-nowrap">
                    <Search className="h-4 w-4" />
                    <span>Search</span>
                  </Button>
                </form>
              </div>

              {/* Role-Specific Secondary Actions */}
              <div className="mt-6 flex items-center gap-4 flex-wrap">
                {user?.role === 'ADMIN' ? (
                  <Link href="/admin">
                    <Button size="md" className="font-semibold">
                      Go to Admin Center
                    </Button>
                  </Link>
                ) : user?.role === 'OWNER' ? (
                  <Link href="/owner">
                    <Button size="md" className="font-semibold">
                      Owner Dashboard
                    </Button>
                  </Link>
                ) : (
                  <Link href="/properties">
                    <Button variant="outline" size="md" className="font-semibold">
                      Find a Property
                    </Button>
                  </Link>
                )}

                {!user && (
                  <Link href="/register?role=OWNER">
                    <Button variant="ghost" size="md" className="font-semibold text-primary hover:text-primary-hover flex items-center gap-1.5">
                      <span>List Your Property</span>
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                )}
              </div>

              {/* Trust Metrics Bar */}
              <div className="mt-10 pt-6 border-t border-border/60 grid grid-cols-3 gap-4 max-w-lg">
                <div>
                  <p className="text-xl sm:text-2xl font-black text-foreground">0%</p>
                  <p className="text-xs text-muted font-medium mt-0.5">Brokerage Fees</p>
                </div>
                <div>
                  <p className="text-xl sm:text-2xl font-black text-foreground">100%</p>
                  <p className="text-xs text-muted font-medium mt-0.5">Direct Owners</p>
                </div>
                <div>
                  <p className="text-xl sm:text-2xl font-black text-foreground">Direct</p>
                  <p className="text-xs text-muted font-medium mt-0.5">Chat & Booking</p>
                </div>
              </div>
            </div>

            {/* Right Hero Image Card */}
            <div className="lg:col-span-5 relative">
              <div className="relative aspect-[4/3] sm:aspect-[16/11] lg:aspect-[4/3] rounded-3xl overflow-hidden shadow-2xl border border-black/5 bg-stone-100">
                <Image
                  src="/images/hero-modern-home.jpg"
                  alt="Modern architectural luxury rental home"
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 550px"
                  className="object-cover"
                />

                {/* Floating Social Proof Pill */}
                <div className="absolute bottom-4 left-4 right-4 sm:bottom-6 sm:left-6 sm:right-6 bg-white/95 backdrop-blur-md p-4 rounded-2xl shadow-lg border border-black/5 flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-full bg-primary-light text-primary flex items-center justify-center flex-shrink-0">
                    <BadgePercent className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground tracking-tight">Direct Owner Guarantee</p>
                    <p className="text-xs text-muted mt-0.5">Save up to 1-2 months rent on brokerage commissions</p>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 2. Featured Listings Section */}
      <section className="py-16 md:py-24 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-10 gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-stone-100 text-stone-700 mb-2">
                <Building2 className="h-3.5 w-3.5 text-primary" />
                <span>Featured Spaces</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
                Recently Added Verified Listings
              </h2>
              <p className="text-sm sm:text-base text-muted mt-1">
                Explore hand-picked properties available for direct rental today.
              </p>
            </div>
            <Link href="/properties">
              <Button variant="outline" className="font-semibold flex items-center gap-2">
                <span>View all properties</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>

          {featuredProperties.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {featuredProperties.map((property: any) => (
                <PropertyCard
                  key={property.id}
                  id={property.id}
                  title={property.title}
                  city={property.city}
                  locality={property.locality}
                  rent={property.rent}
                  bedrooms={property.bedrooms}
                  bathrooms={property.bathrooms}
                  propertyType={property.propertyType}
                  furnishedStatus={property.furnishedStatus}
                  isAvailable={property.isAvailable}
                  images={property.images}
                  isVerified={property.isVerified}
                  averageRating={property.averageRating}
                  reviewCount={property.reviewCount}
                />
              ))}
            </div>
          ) : (
            <div className="bg-card rounded-2xl border border-border p-10 text-center max-w-xl mx-auto shadow-2xs">
              <Home className="h-10 w-10 text-primary mx-auto mb-3" />
              <h3 className="text-lg font-bold text-foreground">Explore Our Fresh Listings</h3>
              <p className="text-sm text-muted mt-1 mb-6">
                New direct homes are added every day across major tech hubs.
              </p>
              <Link href="/properties">
                <Button className="font-semibold">Browse Marketplace</Button>
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* 3. The Direct Advantage (How RentGoer Works) */}
      <section className="py-16 md:py-24 bg-card border-y border-border/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-wider text-primary">The Direct Journey</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight mt-2 mb-4">
              How RentGoer simplifies renting
            </h2>
            <p className="text-base text-muted">
              We replaced obsolete broker networks with transparent technology, direct messaging, and verified trust.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-background rounded-2xl p-7 border border-border/80 flex flex-col items-start transition-all hover:shadow-md">
              <div className="w-12 h-12 rounded-xl bg-primary-light text-primary flex items-center justify-center mb-6">
                <Search className="h-6 w-6" />
              </div>
              <span className="text-xs font-bold text-primary tracking-wider uppercase mb-1">Step 01</span>
              <h3 className="text-xl font-bold text-foreground mb-3">Direct Discovery</h3>
              <p className="text-sm text-muted leading-relaxed">
                Filter by budget, bedrooms, furnishing status, and location. Every listing is reviewed for authenticity with authentic photos.
              </p>
            </div>

            <div className="bg-background rounded-2xl p-7 border border-border/80 flex flex-col items-start transition-all hover:shadow-md">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center mb-6">
                <MessageSquare className="h-6 w-6" />
              </div>
              <span className="text-xs font-bold text-emerald-700 tracking-wider uppercase mb-1">Step 02</span>
              <h3 className="text-xl font-bold text-foreground mb-3">Verified Owners</h3>
              <p className="text-sm text-muted leading-relaxed">
                Chat in real-time with property owners. Ask about lease terms, amenities, and schedule visits without middleman pressure.
              </p>
            </div>

            <div className="bg-background rounded-2xl p-7 border border-border/80 flex flex-col items-start transition-all hover:shadow-md">
              <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center mb-6">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <span className="text-xs font-bold text-amber-700 tracking-wider uppercase mb-1">Step 03</span>
              <h3 className="text-xl font-bold text-foreground mb-3">Zero Brokerage</h3>
              <p className="text-sm text-muted leading-relaxed">
                Submit official rental requests through the platform, track approvals seamlessly, and save your hard-earned money.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Dual Persona Showcase (For Renters & Owners) */}
      <section className="py-16 md:py-24 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-card rounded-3xl border border-border overflow-hidden shadow-sm grid grid-cols-1 lg:grid-cols-12 items-center">

            <div className="lg:col-span-6 relative aspect-[4/3] lg:aspect-auto lg:h-full min-h-[320px] bg-stone-100">
              <Image
                src="/images/interior-living-room.jpg"
                alt="Curated contemporary penthouse living space"
                fill
                sizes="(max-width: 1024px) 100vw, 600px"
                className="object-cover"
              />
            </div>

            <div className="lg:col-span-6 p-8 sm:p-12 lg:p-14 flex flex-col">
              <span className="text-xs font-bold uppercase tracking-wider text-primary mb-2">Designed for trust</span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight mb-6">
                A better rental journey for everyone involved
              </h2>

              <div className="space-y-4 mb-8">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-foreground text-sm">For Tenants</h4>
                    <p className="text-xs sm:text-sm text-muted mt-0.5">
                      Never pay a broker commission again. Direct communication, honest lease terms, and authentic home details.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Home className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-foreground text-sm">For Homeowners</h4>
                    <p className="text-xs sm:text-sm text-muted mt-0.5">
                      List your properties for free, receive direct inquiries, review tenant applications, and retain full lease control.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Link href="/properties">
                  <Button size="md" className="font-semibold w-full sm:w-auto">
                    Explore Properties
                  </Button>
                </Link>
                <Link href="/register?role=OWNER">
                  <Button variant="outline" size="md" className="font-semibold w-full sm:w-auto">
                    List Your Space
                  </Button>
                </Link>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 5. Final CTA Banner */}
      <section className="pb-20 pt-4 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-primary text-white rounded-3xl p-8 sm:p-14 text-center relative overflow-hidden shadow-xl">
            <div className="relative z-10 max-w-2xl mx-auto">
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4 text-white">
                Ready to rent without the broker tax?
              </h2>
              <p className="text-base sm:text-lg text-emerald-100 mb-8 leading-relaxed">
                Join thousands of tenants and property owners finding their match directly on RentGoer.
              </p>
              <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
                <Link href="/properties" className="w-full sm:w-auto">
                  <Button variant="inverted" size="lg" className="w-full sm:w-auto font-bold px-8">
                    Browse Properties
                  </Button>
                </Link>
                <Link href="/register?role=OWNER" className="w-full sm:w-auto">
                  <Button variant="outline" size="lg" className="w-full sm:w-auto border-white/40 text-white bg-primary/20 hover:bg-white/10 font-bold px-8">
                    List Your Space
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
