export default function NewsSidebar() {
  return (
    <div className="sticky top-40 bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
      <h2 className="text-xl font-bold text-white mb-6 uppercase tracking-wider border-b border-neutral-800 pb-4">
        Ostatnie Aktualności
      </h2>
      
      {/* Później tutaj podepniemy dane z Supabase */}
      <div className="space-y-6">
        <div className="group cursor-pointer">
          <span className="text-xs text-yellow-500 font-bold mb-1 block">22 Luty 2026</span>
          <h3 className="text-neutral-200 group-hover:text-yellow-500 transition-colors leading-tight">
            Seminarium z mistrzem z Japonii już w ten weekend!
          </h3>
        </div>
        
        <div className="group cursor-pointer">
          <span className="text-xs text-yellow-500 font-bold mb-1 block">15 Luty 2026</span>
          <h3 className="text-neutral-200 group-hover:text-yellow-500 transition-colors leading-tight">
            Zmiana harmonogramu treningów grupy dziecięcej.
          </h3>
        </div>

        <div className="group cursor-pointer">
          <span className="text-xs text-yellow-500 font-bold mb-1 block">01 Luty 2026</span>
          <h3 className="text-neutral-200 group-hover:text-yellow-500 transition-colors leading-tight">
            Zapisy na obóz letni wystartowały. Sprawdź szczegóły.
          </h3>
        </div>
      </div>
    </div>
  );
}