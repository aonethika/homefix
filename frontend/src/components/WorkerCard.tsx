'use client';
import AppointmentForm from './AppointmentForm';
import ProfessionalChoice from './ProfessionalChoice';

export default function WorkerCard({ worker }: { worker: any }) {
  return <div className="hf-panel rounded-2xl p-3"><ProfessionalChoice worker={{ ...worker, name: worker.user.name, serviceKey: worker.serviceKey || worker.serviceType }} /><AppointmentForm worker={worker}/></div>;
}
