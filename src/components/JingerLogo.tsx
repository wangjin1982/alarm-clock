import jingerLogo from '../../Jinger_Logo.jpg';

export function JingerLogo() {
  return (
    <div className="inline-flex items-center rounded-2xl border border-white/10 bg-white/5 p-1.5 shadow-[0_18px_40px_-28px_rgba(14,165,233,0.75)] backdrop-blur-md">
      <img
        src={jingerLogo}
        alt="Jinger logo"
        className="h-10 w-auto rounded-xl object-contain"
      />
    </div>
  );
}
