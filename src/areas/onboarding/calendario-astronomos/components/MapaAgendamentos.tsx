import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import './map.css';
import { ExternalLink, X } from 'lucide-react';
import type { Agendamento } from '../types';
import { colorForAstronomo, astronomoDisplay, formatDate, kommoLeadUrl } from '../types';

interface Props {
  agendamentos: Agendamento[];
  onSelect?: (a: Agendamento) => void;
  height?: number;
}

const BR_CENTER: [number, number] = [-15.78, -47.93];

/** Faz fitBounds APENAS quando o conjunto de pontos muda, não em todo render. */
function FitBounds({ agendamentos, signature }: { agendamentos: Agendamento[]; signature: string }) {
  const map = useMap();
  useEffect(() => {
    const pts = agendamentos
      .filter((a) => a.latitude != null && a.longitude != null)
      .map((a) => [a.latitude!, a.longitude!] as [number, number]);
    if (pts.length === 0) return;
    if (pts.length === 1) {
      map.setView(pts[0], 9);
      return;
    }
    map.fitBounds(pts as any, { padding: [40, 40] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, signature]);
  return null;
}

export function MapaAgendamentos({ agendamentos, onSelect, height = 380 }: Props) {
  const [hovered, setHovered] = useState<Agendamento | null>(null);

  const comCoord = agendamentos.filter((a) => a.latitude != null && a.longitude != null);

  const signature = useMemo(
    () => comCoord.map((a) => a.task_id).sort((x, y) => x - y).join(','),
    [comCoord],
  );

  return (
    <div className="relative bg-card border rounded-lg" style={{ height }}>
      <MapContainer
        center={BR_CENTER}
        zoom={4}
        scrollWheelZoom
        style={{ height: '100%', width: '100%', borderRadius: 'inherit' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds agendamentos={comCoord} signature={signature} />
        {comCoord.map((a) => (
          <CircleMarker
            key={a.task_id}
            center={[a.latitude!, a.longitude!]}
            radius={hovered?.task_id === a.task_id ? 10 : 7}
            pathOptions={{
              color: colorForAstronomo(a.astronomo),
              fillColor: colorForAstronomo(a.astronomo),
              fillOpacity: hovered?.task_id === a.task_id ? 1 : 0.8,
              weight: hovered?.task_id === a.task_id ? 2 : 1,
            }}
            eventHandlers={{
              click: () => setHovered(a),
            }}
          />
        ))}
      </MapContainer>

      {/* Card flutuante de detalhes — renderizado fora do leaflet pra evitar
          conflitos de stacking context, fica sempre acima do mapa. */}
      {hovered && (
        <div className="absolute top-3 left-3 max-w-[300px] bg-card border rounded-lg shadow-2xl p-3 z-[1100] animate-in fade-in slide-in-from-top-2 duration-150">
          <button
            onClick={() => setHovered(null)}
            className="absolute top-2 right-2 p-0.5 rounded hover:bg-accent text-muted-foreground"
            aria-label="Fechar"
          >
            <X size={14} />
          </button>
          <div className="pr-5 space-y-1">
            <div className="flex items-center gap-1.5">
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ background: colorForAstronomo(hovered.astronomo) }}
              />
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {astronomoDisplay(hovered.astronomo)} · {hovered.desc_tarefa ?? '—'}
              </span>
            </div>
            <p className="text-sm font-semibold leading-tight">
              {hovered.nome_escola ?? '(sem escola)'}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatDate(hovered.data_conclusao)} · {hovered.cidade_estado ?? '—'}
            </p>
          </div>
          <div className="flex items-center gap-3 mt-2 pt-2 border-t border-border/40">
            {onSelect && (
              <button
                type="button"
                onClick={() => { onSelect(hovered); setHovered(null); }}
                className="text-primary hover:underline text-xs font-medium"
              >
                Ver detalhes
              </button>
            )}
            {kommoLeadUrl(hovered.lead_id) && (
              <a
                href={kommoLeadUrl(hovered.lead_id)!}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline text-xs inline-flex items-center gap-1"
              >
                Abrir no Kommo <ExternalLink size={10} />
              </a>
            )}
          </div>
        </div>
      )}

      {comCoord.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-card/80 text-sm text-muted-foreground pointer-events-none rounded-lg">
          Sem coordenadas para os filtros aplicados
        </div>
      )}

      <div className="absolute bottom-2 right-2 bg-card/90 border rounded px-2 py-1 text-[10px] text-muted-foreground pointer-events-none z-[1000]">
        {comCoord.length} de {agendamentos.length} com coordenadas
      </div>
    </div>
  );
}
