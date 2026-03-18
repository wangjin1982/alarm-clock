import jingerLogo from '../../Jinger_Logo.jpg';

interface JingerLogoProps {
  compact?: boolean;
}

export function JingerLogo({ compact = false }: JingerLogoProps) {
  return (
    <div className={`inline-flex items-center border border-white/10 bg-white/5 shadow-[0_18px_40px_-28px_rgba(14,165,233,0.75)] backdrop-blur-md ${
      compact ? 'rounded-xl p-1' : 'rounded-2xl p-1.5'
    }`}>
      <img
        src={jingerLogo}
        alt="Jinger logo"
        className={`w-auto object-contain ${compact ? 'h-7 rounded-lg' : 'h-10 rounded-xl'}`}
      />
    </div>
  );
}
