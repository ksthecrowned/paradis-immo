import './landing.css';
import {
  LandingAdvantages,
  LandingBenefits,
  LandingCta,
  LandingFooter,
  LandingHero,
  LandingNav,
  LandingProperties,
} from '@/components/landing';

export default function HomePage(): React.JSX.Element {
  return (
    <div className="landing min-h-screen antialiased">
      <LandingNav />
      <main>
        <LandingHero />
        <LandingBenefits />
        <LandingProperties />
        <LandingAdvantages />
        <LandingCta />
      </main>
      <LandingFooter />
    </div>
  );
}
