import { Droplets, Hammer, Snowflake, Wrench, Zap } from 'lucide-react';
export default function ServiceIcon({ service, size = 21 }: { service?: string; size?: number }) {
  const Icon = service === 'PLUMBER' ? Droplets : service === 'ELECTRICIAN' ? Zap : service === 'AC_TECHNICIAN' ? Snowflake : service === 'CARPENTER' ? Hammer : Wrench;
  return <Icon size={size} aria-hidden="true" />;
}
