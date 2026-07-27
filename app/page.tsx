import type { Metadata } from 'next';
import { PageHeader, PageBody } from '@/components/PageContent';
import NewsSidebar from '../components/NewsSidebar';

export const revalidate = 300;

export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

export default function Home() {
  return (
    <div className="relative page-shell pb-20 min-h-screen">
      <div className="container-site z-10 relative">
        <div className="flex flex-col lg:flex-row gap-12">

          {/* Treść strony głównej - nagłówek, akapity i film z bazy (panel → Strony). */}
          <div className="lg:w-3/4">
            <PageHeader slug="home" className="mb-10" />
            <PageBody slug="home" />
          </div>

          <div className="lg:w-1/4">
            <NewsSidebar />
          </div>

        </div>
      </div>
    </div>
  );
}
