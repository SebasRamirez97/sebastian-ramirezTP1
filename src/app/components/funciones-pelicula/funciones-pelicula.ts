import { Component, OnInit, signal, inject, computed, effect } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CommonModule, Location } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { FuncionesService } from '../../services/funciones';
import { PeliculasService } from '../../services/peliculas';
import { RolStaffService } from '../../services/rol-staff.service';
import { Pelicula } from '../../models/pelicula.model';
import { OcultarSiStaffDirective } from '../../directives/ocultar-si-staff.directive';
import { MostrarSoloStaffDirective } from '../../directives/mostrar-solo-staff.directive';
import { formatearFechaLocal, obtenerHoyLocal } from '../../utils/fechas.util';

@Component({
  selector: 'app-funciones-pelicula',
  standalone: true,
  imports: [
    RouterLink,
    CommonModule,
    OcultarSiStaffDirective,
    MostrarSoloStaffDirective,
  ],
  templateUrl: './funciones-pelicula.html',
  styleUrls: ['./funciones-pelicula.css'],
})
export class FuncionesPeliculaComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private location = inject(Location);
  private funcionesService = inject(FuncionesService);
  private peliculasService = inject(PeliculasService);
  private rolStaffService = inject(RolStaffService);

  private paramMapSignal = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });

  // 🔹 Signal reactivo del ID de la película según la ruta actual
  peliculaId = computed<string>(() => this.paramMapSignal().get('id') || '');

  // 🔹 Signals de estado
  pelicula = signal<Pelicula | null>(null);
  funciones = signal<any[]>([]);
  cargando = signal<boolean>(true);
  rolVerificado = signal<boolean>(false);

  // 🔹 Signal derivado del rol actual (se actualiza automáticamente al cambiar tipoUsuario())
  rolActual = computed<string>(() => {
    const rolRaw = this.rolStaffService.tipoUsuario();
    return typeof rolRaw === 'string' ? rolRaw.toLowerCase().trim() : '';
  });

  esStaff = computed<boolean>(() => {
    const rol = this.rolActual();
    return rol === 'admin' || rol === 'empleado';
  });

  // 🎟️ Indica si hoy estamos dentro de la ventana de preventa válida de la película
  enPreventaActiva = computed<boolean>(() => {
    const p = this.pelicula();
    if (!p?.fecha_estreno) return false;

    const hoy = obtenerHoyLocal();
    const estreno = formatearFechaLocal(p.fecha_estreno);
    if (!estreno || hoy >= estreno) return false;

    if (!p.preventa_activa) return false;

    const diasPreventa = Number(p.dias_preventa ?? 7);
    const [anio, mes, dia] = estreno.split('-').map(Number);
    const fechaInicioPreventaDate = new Date(anio, mes - 1, dia - diasPreventa);
    const inicioPreventa = formatearFechaLocal(fechaInicioPreventaDate);

    return hoy >= inicioPreventa && hoy < estreno;
  });

  // 📅 Indica si las funciones son visibles para clientes (estrenada/hoy o en preventa activa)
  funcionesHabilitadasCliente = computed<boolean>(() => {
    const p = this.pelicula();
    if (!p?.fecha_estreno) return true;

    const hoy = obtenerHoyLocal();
    const estreno = formatearFechaLocal(p.fecha_estreno);
    if (!estreno) return true;

    if (hoy >= estreno) return true;
    return this.enPreventaActiva();
  });

  // 🔹 Lista de funciones filtrada reactivamente según perfil y estado de estreno/preventa
  funcionesVisibles = computed<any[]>(() => {
    if (this.cargando()) return [];
    const lista = this.funciones();
    if (this.esStaff()) return lista;
    return this.funcionesHabilitadasCliente() ? lista : [];
  });

  constructor() {
    // Recarga automáticamente cuando cambia el ID de la película en la URL
    effect(() => {
      const id = this.peliculaId();
      if (id) {
        void this.cargarDatos(id);
      } else {
        this.pelicula.set(null);
        this.funciones.set([]);
        this.cargando.set(false);
      }
    });
  }

  async ngOnInit(): Promise<void> {
    await this.sincronizarRol();
  }

  private async sincronizarRol(): Promise<void> {
    try {
      await this.rolStaffService.verificarRolActual();
    } catch (error) {
      console.error('Error al verificar el rol del usuario:', error);
    } finally {
      this.rolVerificado.set(true);
    }
  }

  async cargarDatos(id: string = this.peliculaId()): Promise<void> {
    if (!id) return;

    try {
      this.cargando.set(true);
      if (!this.rolVerificado() || this.rolStaffService.tipoUsuario() === null) {
        await this.sincronizarRol();
      }

      const [peliculaData, funcionesData] = await Promise.all([
        this.peliculasService.getPeliculaPorId(id),
        this.funcionesService.getFuncionesPorPelicula(id),
      ]);

      this.pelicula.set(peliculaData);
      this.funciones.set(funcionesData || []);
    } catch (error) {
      console.error('Error al cargar la película y funciones:', error);
    } finally {
      this.cargando.set(false);
    }
  }

  trackByFuncion(index: number, funcion: any): string {
    return funcion.id;
  }

  volver(): void {
    this.location.back();
  }
}