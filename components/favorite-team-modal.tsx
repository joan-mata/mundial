'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from './ui/button';

export function FavoriteTeamModal() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const skip = sessionStorage.getItem('fav_team_skip');
    if (!skip) setOpen(true);
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card border rounded-xl shadow-xl p-6 max-w-sm w-full mx-4 space-y-4">
        <div className="text-2xl text-center">⭐</div>
        <h2 className="text-lg font-bold text-center">Elige tu equipo favorito</h2>
        <p className="text-sm text-muted-foreground text-center">
          Ganas <strong>+1 punto extra</strong> por cada victoria de tu equipo que hayas acertado.
          Una vez elegido no puedes cambiarlo.
        </p>
        <div className="flex gap-2 pt-2">
          <Button
            className="flex-1"
            onClick={() => { setOpen(false); router.push('/profile'); }}
          >
            Elegir equipo
          </Button>
          <Button variant="outline" onClick={() => { sessionStorage.setItem('fav_team_skip', '1'); setOpen(false); }}>
            Ahora no
          </Button>
        </div>
      </div>
    </div>
  );
}
