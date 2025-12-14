import { PlannerGrid } from '@/components/planner/PlannerGrid';
import { Helmet } from 'react-helmet-async';

const Index = () => {
  return (
    <>
      <Helmet>
        <title>Timeboxing</title>
        <meta name="description" content="Gestiona los recursos de tu equipo SEO con el planificador visual de ResourceFlow" />
      </Helmet>
      <div className="h-screen flex flex-col">
        <PlannerGrid />
      </div>
    </>
  );
};

export default Index;
