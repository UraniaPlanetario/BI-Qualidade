import { useState, useMemo } from 'react';
import { Search, ChevronDown, ChevronRight } from 'lucide-react';
import { LeadClosed, formatDateBR } from '../types';

export function DetailBlock({ leads }: { leads: LeadClosed[] }) {
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return leads;
    const term = search.toLowerCase();
    return leads.filter((l) =>
      (l.lead_name || '').toLowerCase().includes(term) ||
      (l.vendedor || '').toLowerCase().includes(term) ||
      (l.cidade_estado || '').toLowerCase().includes(term) ||
      (l.produtos || '').toLowerCase().includes(term)
    );
  }, [leads, search]);

  const toggleExpand = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
  };

  function formatCurrency(value: number | null): string {
    if (value == null) return '—';
    return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="card-glass p-4 rounded-xl">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por nome, vendedor, cidade ou produtos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {filtered.length} lead{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Table */}
      <div className="card-glass rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="w-8"></th>
              <th className="text-left py-3 px-3 text-muted-foreground font-medium">Lead</th>
              <th className="text-left py-3 px-3 text-muted-foreground font-medium">Vendedor</th>
              <th className="text-left py-3 px-3 text-muted-foreground font-medium">Produtos</th>
              <th className="text-left py-3 px-3 text-muted-foreground font-medium">Cidade/Estado</th>
              <th className="text-left py-3 px-3 text-muted-foreground font-medium">Data Fechamento</th>
              <th className="text-left py-3 px-3 text-muted-foreground font-medium">Tipo Cliente</th>
              <th className="text-center py-3 px-3 text-muted-foreground font-medium">#</th>
              <th className="text-center py-3 px-3 text-muted-foreground font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((l) => (
              <>
                <tr
                  key={l.id}
                  onClick={() => toggleExpand(l.id)}
                  className="border-b border-border/50 hover:bg-secondary/30 transition-colors cursor-pointer"
                >
                  <td className="py-2 px-2 text-muted-foreground">
                    {expandedId === l.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </td>
                  <td className="py-2 px-3 text-foreground font-medium max-w-[200px] truncate">{l.lead_name || '—'}</td>
                  <td className="py-2 px-3 text-foreground">{l.vendedor || '—'}</td>
                  <td className="py-2 px-3 text-foreground max-w-[180px] truncate">{l.produtos || '—'}</td>
                  <td className="py-2 px-3 text-foreground">{l.cidade_estado || '—'}</td>
                  <td className="py-2 px-3 text-foreground">{formatDateBR(l.data_fechamento)}</td>
                  <td className="py-2 px-3 text-foreground">{l.tipo_cliente || '—'}</td>
                  <td className="py-2 px-3 text-center text-foreground">{l.occurrence}</td>
                  <td className="py-2 px-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      l.cancelado
                        ? 'bg-red-500/20 text-red-400'
                        : 'bg-green-500/20 text-green-400'
                    }`}>
                      {l.cancelado ? 'Cancelado' : 'Ativo'}
                    </span>
                  </td>
                </tr>
                {expandedId === l.id && (
                  <tr key={`${l.id}-detail`} className="border-b border-border/50 bg-secondary/20">
                    <td></td>
                    <td colSpan={8} className="py-3 px-3">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        <div>
                          <span className="text-muted-foreground">SDR:</span>
                          <span className="text-foreground ml-1">{l.sdr || '—'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Pipeline Origem:</span>
                          <span className="text-foreground ml-1">{l.pipeline_origem || '—'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Data Agendamento:</span>
                          <span className="text-foreground ml-1">{formatDateBR(l.data_agendamento)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Faixa Alunos:</span>
                          <span className="text-foreground ml-1">{l.faixa_alunos || '—'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">N Alunos:</span>
                          <span className="text-foreground ml-1">{l.n_alunos || '—'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">N Diárias:</span>
                          <span className="text-foreground ml-1">{l.n_diarias || '—'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Lead Price:</span>
                          <span className="text-foreground ml-1">{formatCurrency(l.lead_price)}</span>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-8 text-center text-muted-foreground text-sm">
            Nenhum lead encontrado.
          </div>
        )}
      </div>
    </div>
  );
}
