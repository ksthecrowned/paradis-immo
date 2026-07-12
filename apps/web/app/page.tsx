import {
  LandingAdvantages,
  LandingBenefits,
  LandingCta,
  LandingDownload,
  LandingFooter,
  LandingHero,
  LandingNav,
  LandingProperties,
} from '@/components/landing';
import './landing.css';

export default function HomePage(): React.JSX.Element {
  return (
    <div className="landing min-h-screen antialiased">
      <LandingNav />
      <main>
        <LandingHero />
        <LandingBenefits />
        <LandingProperties />
        <LandingAdvantages />
        <LandingDownload />
        <LandingCta />
      </main>
      <LandingFooter />
    </div>
  );
}
