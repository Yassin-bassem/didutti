import { Link } from 'react-router-dom';
import { ShoppingBag, Settings } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import brandLogo from '@/assets/didutti-logo.jpg';

const Header = () => {
  const { totalItems } = useCart();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-foreground/15 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      {/* Top hairline meta strip */}
      <div className="border-b border-foreground/10 bg-primary text-primary-foreground">
        <div className="container flex h-7 items-center justify-between text-[10px] uppercase tracking-[0.3em]">
          <span className="font-sans-alt">Est. 2026 — Cairo</span>
          <span className="font-sans-alt hidden sm:inline">Children's Atelier · أطفال</span>
          <span className="font-sans-alt">N° 001</span>
        </div>
      </div>

      <div className="container flex h-20 items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="flex h-12 w-12 items-center justify-center bg-cream-deep">
            <img
              src={brandLogo}
              alt="DIDUTTI KID'S"
              className="h-10 w-auto object-contain transition-transform group-hover:scale-105"
            />
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-display text-2xl font-extrabold tracking-tight text-primary">
              DiDutti
            </span>
            <span className="eyebrow mt-1">Kid's · أطفال</span>
          </div>
        </Link>

        <nav className="flex items-center gap-2">
          <Link
            to="/checkout"
            className="relative flex items-center gap-2 border border-primary bg-primary px-5 py-2.5 text-primary-foreground transition-all hover:bg-secondary hover:border-secondary btn-bounce"
          >
            <ShoppingBag className="h-4 w-4" strokeWidth={2.25} />
            <span className="font-sans-alt text-xs uppercase tracking-[0.2em] font-semibold">
              السلة
            </span>
            {totalItems > 0 && (
              <span className="absolute -top-2 -left-2 flex h-5 min-w-5 px-1 items-center justify-center bg-secondary text-secondary-foreground text-[10px] font-bold border border-background">
                {totalItems}
              </span>
            )}
          </Link>

          <Link
            to="/admin"
            aria-label="Admin"
            className="border border-foreground/20 p-2.5 text-foreground/70 transition-all hover:border-primary hover:text-primary"
          >
            <Settings className="h-4 w-4" strokeWidth={2.25} />
          </Link>
        </nav>
      </div>
    </header>
  );
};

export default Header;
