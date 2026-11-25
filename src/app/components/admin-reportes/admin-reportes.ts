import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ReportesService,
  ResumenFacturacion,
  PeliculaVistaPeriodo,
  ReporteCandyBar,
} from '../../services/reportes.service';
import { ExportacionService } from '../../services/exportacion.service';

@Component({
  selector: 'app-admin-reportes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-reportes.html',
  styleUrl: './admin-reportes.css',
})
export class AdminReportesComponent implements OnInit {
  cargando = signal<boolean>(false);
  errorMsg = signal<string | null>(null);

  // Filtros
  agrupacion = signal<'semana' | 'mes'>('semana');
  periodoSeleccionado = signal<string>('TODOS');
  fechaDesde = signal<string>('');
  fechaHasta = signal<string>('');

  // Datos
  facturacion = signal<ResumenFacturacion>({
    totalFacturado: 0,
    cantidadOrdenes: 0,
    porMetodoPago: [],
    ordenes: [],
  });

  peliculasVistas = signal<PeliculaVistaPeriodo[]>([]);
  candyBar = signal<ReporteCandyBar>({
    productoMasVendido: null,
    ranking: [],
  });
  logs = signal<any[]>([]);

  // Períodos disponibles según agrupación actual
  periodosDisponibles = computed(() => {
    const map = new Map<string, string>();
    for (const item of this.peliculasVistas()) {
      map.set(item.periodo, item.etiquetaPeriodo);
    }
    return Array.from(map.entries()).map(([periodo, etiqueta]) => ({ periodo, etiqueta }));
  });

  // Películas filtradas por período para el gráfico
  peliculasFiltradas = computed(() => {
    const lista = this.peliculasVistas();
    const sel = this.periodoSeleccionado();
    const filtradas = sel === 'TODOS' ? lista : lista.filter((x) => x.periodo === sel);
    return [...filtradas].sort((a, b) => b.vistas - a.vistas);
  });

  maxVistas = computed(() => {
    const lista = this.peliculasFiltradas();
    if (lista.length === 0) return 1;
    return Math.max(...lista.map((x) => x.vistas), 1);
  });

  constructor(
    private reportesService: ReportesService,
    private exportacionService: ExportacionService,
  ) {}

  async ngOnInit(): Promise<void> {
    await this.cargarTodo();
  }

  async cargarTodo(): Promise<void> {
    this.cargando.set(true);
    this.errorMsg.set(null);

    const filtro = {
      desde: this.fechaDesde() || undefined,
      hasta: this.fechaHasta() || undefined,
    };

    try {
      const [fac, vistas, candy, actividad] = await Promise.all([
        this.reportesService.getReporteFacturacion(filtro),
        this.reportesService.getPeliculasMasVistas(this.agrupacion(), filtro),
        this.reportesService.getProductoCandyMasVendido(filtro),
        this.reportesService.getLogActividad(150),
      ]);

      this.facturacion.set(fac);
      this.peliculasVistas.set(vistas);
      this.candyBar.set(candy);
      this.logs.set(actividad);

      // Si el período seleccionado ya no existe en la nueva agrupación, volvemos a TODOS
      const existe = vistas.some((v) => v.periodo === this.periodoSeleccionado());
      if (!existe) {
        this.periodoSeleccionado.set('TODOS');
      }
    } catch (err: any) {
      this.errorMsg.set(err?.message || 'Error al cargar los reportes del panel.');
    } finally {
      this.cargando.set(false);
    }
  }

  async cambiarAgrupacion(nueva: 'semana' | 'mes'): Promise<void> {
    if (this.agrupacion() === nueva) return;
    this.agrupacion.set(nueva);
    this.periodoSeleccionado.set('TODOS');
    await this.cargarTodo();
  }

  async limpiarFiltros(): Promise<void> {
    this.fechaDesde.set('');
    this.fechaHasta.set('');
    this.periodoSeleccionado.set('TODOS');
    await this.cargarTodo();
  }

  obtenerPorcentajeBarra(vistas: number): number {
    return Math.round((vistas / this.maxVistas()) * 100);
  }

  private construirRangoTexto(): string {
    const desde = this.fechaDesde();
    const hasta = this.fechaHasta();
    if (!desde && !hasta) return 'Todo el historial';
    return `${desde || 'Inicio'} -> ${hasta || 'Hoy'}`;
  }

  exportarExcel(): void {
    this.exportacionService.exportarExcel({
      facturacion: this.facturacion(),
      peliculasVistas: this.peliculasFiltradas(),
      agrupacionPeliculas: this.agrupacion(),
      candyBar: this.candyBar(),
      logs: this.logs(),
      rangoTexto: this.construirRangoTexto(),
    });
  }

  exportarPDF(): void {
    this.exportacionService.exportarPDF({
      facturacion: this.facturacion(),
      peliculasVistas: this.peliculasFiltradas(),
      agrupacionPeliculas: this.agrupacion(),
      candyBar: this.candyBar(),
      logs: this.logs(),
      rangoTexto: this.construirRangoTexto(),
    });
  }
}